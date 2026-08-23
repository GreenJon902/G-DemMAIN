class Problem(Exception):
    """
    Something wrong enough to report, but not to abort the run for. Collected and printed
    both as it occurs and in the end-of-run summary.
    """

    def __init__(self, source_path, message):
        super().__init__(message)
        self.source_path = source_path
        self.message = message


class WriterCheckFailure(Problem):
    """ A Problem raised while deciding whether/how a file should be written. """


class UnsupportedExtension(Problem):
    def __init__(self, source_path, extension):
        super().__init__(source_path, f'Unsupported extension "{extension}" - "{source_path}"')
        self.extension = extension


class MarkerExistsInSource(WriterCheckFailure):
    def __init__(self, source_path):
        super().__init__(source_path, f'G_MARKER already exists in source file - "{source_path}"')


class DestinationMissingMarker(WriterCheckFailure):
    def __init__(self, source_path, dest_path):
        super().__init__(
            source_path,
            f'Destination file has no marker but source requires one - "{source_path}" - "{dest_path}"',
        )
        self.dest_path = dest_path


class Skipped(Exception):
    """
    Raised when a write is rejected by the user (or a pre-check declined). Carries only
    dest_path - not a Problem, tallied separately in the summary.
    """

    def __init__(self, source_path, dest_path):
        self.source_path = source_path
        self.dest_path = dest_path


class AlreadyUpToDate(Exception):
    """
    Raised by a checker when the destination already matches - stops the rest of the chain
    (write and every remaining after-hook, e.g. validate_sudoers re-running visudo for nothing)
    from running, since there's nothing to do.
    """

    def __init__(self, source_path, dest_path):
        self.source_path = source_path
        self.dest_path = dest_path
