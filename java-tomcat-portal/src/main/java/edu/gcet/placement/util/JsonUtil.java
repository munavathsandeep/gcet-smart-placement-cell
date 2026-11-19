package edu.gcet.placement.util;

import com.google.gson.Gson;
import com.google.gson.GsonBuilder;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

import java.io.BufferedReader;
import java.io.IOException;
import java.util.HashMap;
import java.util.Map;

public final class JsonUtil {
    private static final Gson GSON = new GsonBuilder()
            .setDateFormat("yyyy-MM-dd")
            .create();

    private JsonUtil() {}

    public static Gson gson() {
        return GSON;
    }

    public static <T> T readBody(HttpServletRequest req, Class<T> clazz) throws IOException {
        StringBuilder sb = new StringBuilder();
        try (BufferedReader reader = req.getReader()) {
            String line;
            while ((line = reader.readLine()) != null) {
                sb.append(line);
            }
        }
        return GSON.fromJson(sb.toString(), clazz);
    }

    public static void sendSuccess(HttpServletResponse resp, int status, Object data) throws IOException {
        resp.setStatus(status);
        resp.setContentType("application/json;charset=UTF-8");
        Map<String, Object> payload = new HashMap<>();
        payload.put("success", true);
        payload.put("data", data);
        resp.getWriter().write(GSON.toJson(payload));
    }

    public static void sendError(HttpServletResponse resp, int status, String message) throws IOException {
        resp.setStatus(status);
        resp.setContentType("application/json;charset=UTF-8");
        Map<String, Object> payload = new HashMap<>();
        payload.put("success", false);
        payload.put("error", message);
        resp.getWriter().write(GSON.toJson(payload));
    }
}
