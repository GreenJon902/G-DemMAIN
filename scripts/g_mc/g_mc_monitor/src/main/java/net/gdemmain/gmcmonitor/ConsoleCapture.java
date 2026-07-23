package net.gdemmain.gmcmonitor;

import org.apache.logging.log4j.Level;
import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.core.LogEvent;
import org.apache.logging.log4j.core.LoggerContext;
import org.apache.logging.log4j.core.appender.AbstractAppender;
import org.apache.logging.log4j.core.config.Property;

import java.time.Instant;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Deque;
import java.util.List;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.function.Consumer;

/**
 * A Log4j2 appender attached to the root logger so it sees the same lines that appear on the
 * server's actual stdout - vanilla log output, chat, and command feedback all go through here,
 * which is what lets the console socket stream "everything printed to console" without needing
 * separate hooks for chat/commands. Capped at INFO and above (see register()) - DEBUG/TRACE are
 * only enabled in dev (gradlew runServer uses a different root log level than production), so
 * streaming them would mean the console socket behaves inconsistently between environments.
 */
public class ConsoleCapture extends AbstractAppender {
	private static final int HISTORY_SIZE = 10;
	// ISO 8601/RFC 3339 in UTC with millisecond precision, e.g. "2026-07-20T14:07:00.123Z" - a fixed
	// width so it also sorts correctly as a plain string, which matters since this is what lets
	// clients order lines from multiple sources
	private static final DateTimeFormatter DATETIME_FORMAT =
			DateTimeFormatter.ofPattern("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'").withZone(ZoneOffset.UTC);

	/** One captured console line, broken out into fields instead of a single pre-formatted string. */
	public record ConsoleLine(String datetime, String level, String thread, String message) {
	}

	private final Deque<ConsoleLine> history = new ArrayDeque<>();
	private final List<Consumer<ConsoleLine>> listeners = new CopyOnWriteArrayList<>();

	public ConsoleCapture() {
		super("g_mc_monitor-console-capture", null, null, false, Property.EMPTY_ARRAY);
	}

	/** Starts the appender and attaches it to the root logger - call once during mod init. */
	public void register() {
		start();
		LoggerContext context = (LoggerContext) LogManager.getContext(false);
		context.getConfiguration().getRootLogger().addAppender(this, Level.INFO, null);
	}

	@Override
	public void append(LogEvent event) {
		ConsoleLine line = new ConsoleLine(
				DATETIME_FORMAT.format(Instant.ofEpochMilli(event.getTimeMillis())),
				event.getLevel().toString(),
				event.getThreadName(),
				event.getMessage().getFormattedMessage());
		synchronized (history) {
			history.addLast(line);
			while (history.size() > HISTORY_SIZE) {
				history.removeFirst();
			}
		}
		for (Consumer<ConsoleLine> listener : listeners) {
			listener.accept(line);
		}
	}

	/** The most recent (up to) 10 console lines, oldest first. */
	public List<ConsoleLine> getHistory() {
		synchronized (history) {
			return new ArrayList<>(history);
		}
	}

	/** Registers a callback invoked with every new console line, in order, from here on. */
	public void addListener(Consumer<ConsoleLine> listener) {
		listeners.add(listener);
	}

	public void removeListener(Consumer<ConsoleLine> listener) {
		listeners.remove(listener);
	}
}
