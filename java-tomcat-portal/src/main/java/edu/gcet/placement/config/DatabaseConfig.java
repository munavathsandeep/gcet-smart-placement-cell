package edu.gcet.placement.config;

import com.zaxxer.hikari.HikariConfig;
import com.zaxxer.hikari.HikariDataSource;

import java.io.InputStream;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.Properties;

/**
 * Centralized HikariCP DataSource configuration for GCET Placement Hub.
 * Precedence order:
 *   1. Environment variables (GCET_DB_URL / DB_URL, GCET_DB_USER / DB_USERNAME, GCET_DB_PASS / DB_PASSWORD)
 *   2. JVM system properties (-DGCET_DB_URL, -DGCET_DB_USER, -DGCET_DB_PASS)
 *   3. Classpath properties file (database.properties or db.properties)
 */
public final class DatabaseConfig {
    private static final String DEFAULT_URL =
            "jdbc:mysql://localhost:3306/gcet_placement_hub?useSSL=false&allowPublicKeyRetrieval=true&serverTimezone=Asia/Kolkata";

    private static volatile HikariDataSource dataSource;
    private static String jdbcUrl;
    private static String jdbcUser;
    private static String jdbcPassword;

    static {
        loadConfiguration();
    }

    private DatabaseConfig() {}

    private static void loadConfiguration() {
        Properties props = new Properties();
        loadPropertiesFile("db.properties", props);
        loadPropertiesFile("database.properties", props);

        jdbcUrl = firstNonBlank(
                System.getenv("GCET_DB_URL"),
                System.getenv("DB_URL"),
                System.getProperty("GCET_DB_URL"),
                props.getProperty("DB_URL"),
                props.getProperty("db.url"),
                DEFAULT_URL
        );
        jdbcUser = firstNonBlank(
                System.getenv("GCET_DB_USER"),
                System.getenv("DB_USERNAME"),
                System.getProperty("GCET_DB_USER"),
                props.getProperty("DB_USERNAME"),
                props.getProperty("db.username"),
                "YOUR_MYSQL_USERNAME"
        );
        jdbcPassword = firstNonBlankAllowEmpty(
                System.getenv("GCET_DB_PASS"),
                System.getenv("DB_PASSWORD"),
                System.getProperty("GCET_DB_PASS"),
                props.getProperty("DB_PASSWORD"),
                props.getProperty("db.password"),
                "YOUR_MYSQL_PASSWORD"
        );
    }

    private static void loadPropertiesFile(String resourceName, Properties target) {
        try (InputStream is = DatabaseConfig.class.getClassLoader().getResourceAsStream(resourceName)) {
            if (is != null) {
                target.load(is);
            }
        } catch (Exception ignored) {
        }
    }

    public static synchronized HikariDataSource getDataSource() throws SQLException {
        if (hasPlaceholderCredentials()) {
            throw new SQLException(
                    "MySQL credentials are still set to placeholders (YOUR_MYSQL_USERNAME / YOUR_MYSQL_PASSWORD). " +
                    "Update src/main/resources/database.properties or set GCET_DB_USER and GCET_DB_PASS."
            );
        }
        if (dataSource == null || dataSource.isClosed()) {
            try {
                Class.forName("com.mysql.cj.jdbc.Driver");
            } catch (ClassNotFoundException e) {
                throw new SQLException("MySQL JDBC Driver not found on classpath.", e);
            }
            HikariConfig cfg = new HikariConfig();
            cfg.setJdbcUrl(jdbcUrl);
            cfg.setUsername(jdbcUser);
            cfg.setPassword(jdbcPassword);
            cfg.setPoolName("GCETPlacementHubPool");
            cfg.setMaximumPoolSize(15);
            cfg.setMinimumIdle(2);
            cfg.setConnectionTimeout(8000);
            cfg.setIdleTimeout(300000);
            cfg.addDataSourceProperty("cachePrepStmts", "true");
            cfg.addDataSourceProperty("prepStmtCacheSize", "250");
            cfg.addDataSourceProperty("prepStmtCacheSqlLimit", "2048");
            dataSource = new HikariDataSource(cfg);
        }
        return dataSource;
    }

    public static Connection getConnection() throws SQLException {
        return getDataSource().getConnection();
    }

    public static boolean hasPlaceholderCredentials() {
        return "YOUR_MYSQL_USERNAME".equals(jdbcUser) || "YOUR_MYSQL_PASSWORD".equals(jdbcPassword);
    }

    public static boolean testConnection() {
        if (hasPlaceholderCredentials()) {
            return false;
        }
        try (Connection conn = getConnection();
             PreparedStatement ps = conn.prepareStatement("SELECT 1");
             ResultSet rs = ps.executeQuery()) {
            return rs.next();
        } catch (SQLException e) {
            return false;
        }
    }

    public static String getJdbcUrl() {
        return jdbcUrl;
    }

    public static synchronized void shutdown() {
        if (dataSource != null && !dataSource.isClosed()) {
            dataSource.close();
        }
    }

    private static String firstNonBlank(String... candidates) {
        for (String c : candidates) {
            if (c != null && !c.isBlank()) {
                return c.trim();
            }
        }
        return "";
    }

    private static String firstNonBlankAllowEmpty(String... candidates) {
        for (String c : candidates) {
            if (c != null) {
                return c.trim();
            }
        }
        return "";
    }
}
