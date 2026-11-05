'use client';

import { createContext, useContext, useInsertionEffect, useState, type ReactNode } from 'react';
import { setNonce } from 'get-nonce';

const NonceContext = createContext<string | undefined>(undefined);

export function useNonce() {
  return useContext(NonceContext);
}

/** Radix usa get-nonce al insertar las hojas del bloqueo de scroll. */
export function NonceProvider({ nonce, children }: { nonce: string; children: ReactNode }) {
  // Un refresh RSC puede traer otro nonce; la CSP del documento abierto sigue
  // siendo la original hasta una navegación completa del navegador.
  const [nonceDocumento] = useState(nonce);
  useInsertionEffect(() => { setNonce(nonceDocumento); }, [nonceDocumento]);
  return <NonceContext.Provider value={nonceDocumento}>{children}</NonceContext.Provider>;
}
