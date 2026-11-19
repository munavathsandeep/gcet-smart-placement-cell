package edu.gcet.placement.util;

/**
 * Legacy entrypoint delegating to {@link InitialAccountSeeder#seedOnce()}.
 */
public final class DatabaseSeeder {
    private DatabaseSeeder() {}

    public static void ensureInitialAccountsSeeded() {
        InitialAccountSeeder.seedOnce();
    }
}
