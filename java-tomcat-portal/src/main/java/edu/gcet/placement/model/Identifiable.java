package edu.gcet.placement.model;

/**
 * Contract for domain entities that possess a unique database identifier.
 */
public interface Identifiable {
    int getId();
    void setId(int id);
}
