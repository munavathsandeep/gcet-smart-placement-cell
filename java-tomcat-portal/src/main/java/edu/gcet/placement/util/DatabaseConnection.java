package edu.gcet.placement.util;

import edu.gcet.placement.config.DatabaseConfig;

import java.sql.Connection;
import java.sql.SQLException;

/**
 * Reusable JDBC DatabaseConnection helper delegating to HikariCP DatabaseConfig pool.
 */
public final class DatabaseConnection {
    private DatabaseConnection() {}

    public static Connection getConnection() throws SQLException {
        return DatabaseConfig.getConnection();
    }

    public static void rollbackQuietly(Connection conn) {
        if (conn != null) {
            try {
                if (!conn.getAutoCommit()) {
                    conn.rollback();
                }
            } catch (SQLException ignored) {
            }
        }
    }

    public static void closeQuietly(Connection conn) {
        if (conn != null) {
            try {
                if (!conn.getAutoCommit()) {
                    conn.setAutoCommit(true);
                }
                conn.close();
            } catch (SQLException ignored) {
            }
        }
    }
}
