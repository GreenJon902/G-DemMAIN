# Composable Field types that build up a per-retention-rule schema tree - see monitor.py, which
# builds one tree per rule (via build_schema) and drives it every mainloop tick via
# iterate()/finalise() rather than hand-rolling a diff/aggregate function per field shape

from abc import ABC, abstractmethod


class Field(ABC):
    """
    Base class for every node in a schema tree. iterate() folds one mainloop tick's raw reading
    into whatever state this field needs (a no-op for everything except AggregateField).
    finalise() turns that state (plus this tick's raw reading and the previous record's raw
    reading, as baseline) into the value that goes into the record being written.
    """
    @abstractmethod
    def iterate(self, data, dt):
        """Folds one tick's reading (data, possibly None) into this field's state, weighted by dt."""

    @abstractmethod
    def finalise(self, data, baseline, actualPeriod):
        """
        Returns this field's value for the record being written now. data/baseline are this and
        the previous record's raw readings, actualPeriod is the real time elapsed since the
        previous record for this rule (None for the first record ever).
        """

    @property
    def wantsexpand(self):
        # Only AggregateField's expand flag ever makes this True - see GroupField.finalise
        return False


class TimeElapsedField(Field):
    """Reports the real time elapsed since the previous record."""
    def iterate(self, data, dt):
        pass

    def finalise(self, data, baseline, actualPeriod):
        return actualPeriod


class CumulativeField(Field):
    """A monotonically-increasing counter - reports the delta since the previous record."""
    def iterate(self, data, dt):
        pass

    def finalise(self, data, baseline, actualPeriod):
        if data is None or baseline is None:
            return None
        return data - baseline


class SnapshotField(Field):
    """A gauge reading reported as-is, ignoring any previous record."""
    def iterate(self, data, dt):
        pass

    def finalise(self, data, baseline, actualPeriod):
        return data


class AggregateField(Field):
    """
    A gauge reading reported as {"min", "mean", "max"} across every tick since the previous
    record. mean is time-weighted by each tick's real dt. expand controls whether the parent
    splices this field's {"min", "mean", "max"} directly into its own record dict, or nests it
    under this field's own key - see GroupField.finalise.
    """
    def __init__(self, expand=False):
        self._expand = expand
        self.running_min = None
        self.running_max = None
        self.weighted_sum = None
        self.total_weight = 0.0
        self.has_been_finalised = False

    @property
    def wantsexpand(self):
        return self._expand

    def iterate(self, data, dt):
        if data is None:
            return
        self.running_min = data if self.running_min is None else min(self.running_min, data)
        self.running_max = data if self.running_max is None else max(self.running_max, data)
        self.weighted_sum = data * dt if self.weighted_sum is None else self.weighted_sum + data * dt
        self.total_weight += dt

    def finalise(self, data, baseline, actualPeriod):
        # A fresh instance's first-ever finalise() always reports a gap, even if ticks were
        # already folded in - otherwise a restart makes the next record look like it covers the
        # whole window when it only covers however much of it happened since the restart (technically it could cover the entire window and we still return None. It was easiest to implement it this way)
        is_first_finalise = not self.has_been_finalised
        self.has_been_finalised = True

        if is_first_finalise or self.running_min is None:
            result = None
        else:
            mean = self.running_min if self.total_weight == 0 else self.weighted_sum / self.total_weight
            result = {"min": self.running_min, "mean": mean, "max": self.running_max}
        
        # Reset trackers
        self.running_min = None
        self.running_max = None
        self.weighted_sum = None
        self.total_weight = 0.0
        return result


class GroupField(Field):
    """
    A fixed, named set of child fields - JSON-object shaped. Non-expand children keep their own
    key in the record; expand children (only ever AggregateField(expand=True)) splice their
    {"min", "mean", "max"} directly into this field's own record dict instead.
    If _fold is True (default) and all child values are None, then finalise will return None (rather than the dict).
    """
    def __init__(self, **kwargs):
        self._fold = kwargs.pop("_fold", True)
        self.children = kwargs  # All remaining fields are children

    def iterate(self, data, dt):
        if data is None:
            return
        for field_name, field_schema in self.children.items():
            field_schema.iterate(data.get(field_name), dt)

    def finalise(self, data, baseline, actualPeriod):
        if data is None:
            return None

        # Finalise child data
        baseline = baseline or {}
        record = {}
        for field_name, field_schema in self.children.items():
            field_value = field_schema.finalise(data.get(field_name), baseline.get(field_name), actualPeriod)
            # Is child data nested, or do returned keys replace the field_name
            if field_schema.wantsexpand:
                if field_value is None:
                    return None
                record.update(field_value)
            else:
                record[field_name] = field_value

        # If all values are None (and folding is enabled) then return None (rather than a dict of values with None)
        if self._fold and all(value is None for value in record.values()):
            # TODO: this only produces JSON matching the documented schema (e.g. sys_cpu.agg and
            # sys_cpu.ind both becoming null together) because read_data() happens to source every
            # child of a given GroupField atomically today (one regex pass, one baseline reset
            # trigger) - if a future change let one child go missing independently of its siblings,
            # this would silently produce a shape the schema doesn't promise, since this has no way
            # to know why every child came back None
            return None
        return record


class MapField(Field):
    """
    A variable set of keys that all share one Field shape (e.g. one entry per cgroup, or per
    network interface). child_builder is a zero-arg callable making a fresh child instance per
    key, since children are stateful (independent AggregateField trackers per key).
    If _fold is True (default) and all child values are None, then finalise will return None (rather than the dict).
    """
    def __init__(self, child_builder, _fold = True):
        self.child_builder = child_builder
        self._fold = _fold
        self.children_by_key = {}

    def iterate(self, data, dt):
        if data is None:
            return
        for key, value in data.items():
            self.children_by_key.setdefault(key, self.child_builder()).iterate(value, dt)

    def finalise(self, data, baseline, actualPeriod):
        if data is None:
            return {}

        baseline = baseline or {}
        record = {}
        for key, value in data.items():
            child = self.children_by_key.setdefault(key, self.child_builder())
            record[key] = child.finalise(value, baseline.get(key), actualPeriod)

        # Drop children for keys no longer present, so e.g. an unplugged network interface's
        # tracker doesn't linger forever
        for key in list(self.children_by_key):
            if key not in data:
                del self.children_by_key[key]

        # If all values are None (and folding is enabled) then return None (rather than a dict of values with None)
        if self._fold and all(value is None for value in record.values()):
            # TODO: this only produces JSON matching the documented schema (e.g. sys_cpu.agg and
            # sys_cpu.ind both becoming null together) because read_data() happens to source every
            # child of a given GroupField atomically today (one regex pass, one baseline reset
            # trigger) - if a future change let one child go missing independently of its siblings,
            # this would silently produce a shape the schema doesn't promise, since this has no way
            # to know why every child came back None
            return None
        return record
