package edu.gcet.placement.filter;

import jakarta.servlet.*;
import java.io.IOException;

/**
 * Legacy filter stub retained for backwards package compatibility;
 * unified RBAC and session enforcement now executes via {@link RoleAuthorizationFilter}.
 */
public class AuthFilter implements Filter {
    @Override
    public void doFilter(ServletRequest request, ServletResponse response, FilterChain chain)
            throws IOException, ServletException {
        chain.doFilter(request, response);
    }
}
