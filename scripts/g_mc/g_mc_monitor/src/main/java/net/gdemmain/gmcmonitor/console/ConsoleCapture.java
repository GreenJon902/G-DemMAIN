package net.gdemmain.gmcmonitor.console;

import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.core.Layout;
import org.apache.logging.log4j.core.LogEvent;
import org.apache.logging.log4j.core.LoggerContext;
import org.apache.logging.log4j.core.appender.AbstractAppender;
import org.apache.logging.log4j.core.config.Property;
import org.apache.logging.log4j.core.layout.PatternLayout;

import java.nio.charset.StandardCharsets;
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
 * separate hooks for chat/commands.
 */
public class ConsoleCapture extends AbstractAppender {
	private static final int HISTORY_SIZE = 10;

	private final Deque<String> history = new ArrayDeque<>();
	private final List<Consumer<String>> listeners = new CopyOnWriteArrayList<>();

	public ConsoleCapture() {
		super("g_mc_monitor-console-capture", null, defaultLayout(), false, Property.EMPTY_ARRAY);
	}

	private static Layout<?> defaultLayout() {
		return PatternLayout.newBuilder()
				.withPattern("[%d{HH:mm:ss}] [%t/%level]: %msg%n")
				.build();
	}

	/** Starts the appender and attaches it to the root logger - call once during mod init. */
	public void register() {
		start();
		LoggerContext context = (LoggerContext) LogManager.getContext(false);
		context.getConfiguration().getRootLogger().addAppender(this, null, null);
	}

	@Override
	public void append(LogEvent event) {
		String line = new String(getLayout().toByteArray(event), StandardCharsets.UTF_8).stripTrailing();
		synchronized (history) {
			history.addLast(line);
			while (history.size() > HISTORY_SIZE) {
				history.removeFirst();
			}
		}
		for (Consumer<String> listener : listeners) {
			listener.accept(line);
		}
	}

	/** The most recent (up to) 10 console lines, oldest first. */
	public List<String> getHistory() {
		synchronized (history) {
			return new ArrayList<>(history);
		}
	}

	/** Registers a callback invoked with every new console line, in order, from here on. */
	public void addListener(Consumer<String> listener) {
		listeners.add(listener);
	}

	public void removeListener(Consumer<String> listener) {
		listeners.remove(listener);
	}
}
