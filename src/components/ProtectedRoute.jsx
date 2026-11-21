import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';

/**
 * Protege rotas que exigem autenticação.
 * Visitantes são enviados ao Login com ?redirect= para retomar a ação
 * desejada após autenticar (sem loop e sem voltar forçadamente à home).
 */
export default function ProtectedRoute({ isAuthenticated, children }) {
  const location = useLocation();

  if (!isAuthenticated) {
    const target = `${location.pathname}${location.search}`;
    return <Navigate to={`/login?redirect=${encodeURIComponent(target)}`} replace />;
  }

  return children;
}
