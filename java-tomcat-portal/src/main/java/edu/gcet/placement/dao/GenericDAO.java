package edu.gcet.placement.dao;

import edu.gcet.placement.util.PortalException;
import java.util.List;
import java.util.Optional;

/**
 * Generic CRUD contract implemented by JDBC DAO classes.
 */
public interface GenericDAO<T, ID> {
    Optional<T> findById(ID id) throws PortalException;
    List<T> findAll() throws PortalException;
    T save(T entity) throws PortalException;
    boolean update(T entity) throws PortalException;
    boolean deleteById(ID id) throws PortalException;
}
