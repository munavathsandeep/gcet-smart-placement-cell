package edu.gcet.placement.util;

/**
 * Custom checked/runtime exception hierarchy for clean separation of persistence,
 * validation, authentication, and business errors without exposing internal SQL details.
 */
public class PortalException extends Exception {
    private final int statusCode;

    public PortalException(String message, int statusCode) {
        super(message);
        this.statusCode = statusCode;
    }

    public PortalException(String message, int statusCode, Throwable cause) {
        super(message, cause);
        this.statusCode = statusCode;
    }

    public int getStatusCode() {
        return statusCode;
    }
}
