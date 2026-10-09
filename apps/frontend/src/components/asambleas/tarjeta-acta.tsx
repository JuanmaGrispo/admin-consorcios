'use client';

import { Download, FileText, Upload } from 'lucide-react';
import { useRef, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ApiError } from '@/lib/api';
import { asambleasService } from '@/services/asambleas';
import type { AsambleaDetalle } from '@/types/asamblea';

interface TarjetaActaProps {
  asamblea: AsambleaDetalle;
  /** Después de cargar el acta: que la página recargue el detalle. */
  onCargada: () => void;
}

/**
 * El acta: se baja el borrador en PDF para completarlo y firmarlo, y una vez
 * cerrada la asamblea se sube el acta firmada.
 */
export function TarjetaActa({ asamblea, onCargada }: TarjetaActaProps) {
  const entrada = useRef<HTMLInputElement>(null);
  const [trabajando, setTrabajando] = useState<'borrador' | 'subir' | null>(null);
  const cerrada = asamblea.estado === 'CERRADA' || asamblea.estado === 'CERRADA_SIN_QUORUM';

  async function bajarBorrador() {
    setTrabajando('borrador');
    try {
      await asambleasService.descargarActaBorrador(asamblea.id, asamblea.titulo);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'No se pudo generar el borrador del acta.');
    } finally {
      setTrabajando(null);
    }
  }

  async function subir(archivo: File | undefined) {
    if (!archivo) return;
    setTrabajando('subir');
    try {
      await asambleasService.cargarActa(asamblea.id, archivo);
      toast.success('Acta cargada');
      onCargada();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'No se pudo cargar el acta.');
    } finally {
      setTrabajando(null);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Acta</CardTitle>
        <CardDescription>
          {asamblea.actaUrl
            ? 'El acta firmada ya está cargada.'
            : cerrada
              ? 'Falta subir el acta firmada.'
              : 'El borrador trae quórum, asistencia, orden del día y resultados. Se puede bajar en cualquier momento.'}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-2">
        {asamblea.actaUrl && (
          <Button asChild variant="outline">
            <a href={asamblea.actaUrl} target="_blank" rel="noreferrer">
              <FileText data-icon="inline-start" />
              Ver acta firmada
            </a>
          </Button>
        )}
        <Button variant="outline" onClick={bajarBorrador} disabled={trabajando !== null}>
          <Download data-icon="inline-start" />
          {trabajando === 'borrador' ? 'Generando…' : 'Borrador en PDF'}
        </Button>
        {cerrada && (
          <>
            <Input
              ref={entrada}
              type="file"
              accept="application/pdf"
              className="sr-only"
              aria-label="Acta firmada"
              onChange={(e) => {
                void subir(e.target.files?.[0]);
                e.target.value = '';
              }}
            />
            <Button onClick={() => entrada.current?.click()} disabled={trabajando !== null}>
              <Upload data-icon="inline-start" />
              {trabajando === 'subir' ? 'Subiendo…' : asamblea.actaUrl ? 'Reemplazar acta' : 'Subir acta firmada'}
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
