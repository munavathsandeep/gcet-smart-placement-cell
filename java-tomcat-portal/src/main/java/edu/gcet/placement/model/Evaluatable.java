package edu.gcet.placement.model;

/**
 * Contract for entities capable of producing a normalized readiness or evaluation score.
 */
public interface Evaluatable {
    double computeReadinessScore();
    String getEvaluationSummary();
}
