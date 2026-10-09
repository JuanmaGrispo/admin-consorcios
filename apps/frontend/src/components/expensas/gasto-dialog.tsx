'use client';

import { FileText, X } from 'lucide-react';
import { useState } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { usePedido } from '@/hooks/use-pedido';
import { ApiError, subirArchivo } from '@/lib/api';
import { proveedoresService } from '@/services/proveedores';
import { rubrosGastoService } from '@/services/rubros-gasto';
import { NATURALEZAS_GASTO, type NaturalezaGasto } from '@/types/catalogo';
import type { Gasto, GastoInput } from '@/types/expensa';

/** Sin proveedor: el Select no acepta un valor vacío. */
const SIN_PROVEEDOR = 'ninguno';

interface GastoDialogProps {
  consorcioId: string;
  /** Debajo del título: el período. */
  subtitulo: string;
  /** Si viene, edita ese gasto; si no, es un alta. */
  gasto?: Gasto;
  onGuardar: (input: GastoInput) => Promise<void>;
  onCerrar: () => void;
}

/** Alta y edición de un gasto del período, con su comprobante. */
export function GastoDialog({ consorcioId, subtitulo, gasto, onGuardar, onCerrar }: GastoDialogProps) {
  const rubros = usePedido(`rubros:${consorcioId}`, () => rubrosGastoService.listar(consorcioId)).datos;
  const proveedores = usePedido(`proveedores:${consorcioId}`, () =>
    proveedoresService.listar({ consorcioId }),
  ).datos;

  const [rubroId, setRubroId] = useState(gasto?.rubroId ?? '');
  const [proveedorId, setProveedorId] = useState(gasto?.proveedorId ?? SIN_PROVEEDOR);
  const [descripcion, setDescripcion] = useState(gasto?.descripcion ?? '');
  const [monto, setMonto] = useState(gasto ? String(gasto.monto) : '');
  // Vacía: la toma del rubro. Sólo se manda si se eligió a mano.
  const [naturaleza, setNaturaleza] = useState<NaturalezaGasto | ''>(gasto?.naturaleza ?? '');
  const [comprobanteNumero, setComprobanteNumero] = useState(gasto?.comprobanteNumero ?? '');
  const [comprobante, setComprobante] = useState<{ url: string; nombre: string } | null>(
    gasto?.comprobanteUrl ? { url: gasto.comprobanteUrl, nombre: 'Comprobante cargado' } : null,
  );
  const [cuotaNumero, setCuotaNumero] = useState(gasto?.cuotaNumero ? String(gasto.cuotaNumero) : '');
  const [cuotaTotal, setCuotaTotal] = useState(gasto?.cuotaTotal ? String(gasto.cuotaTotal) : '');
  const [subiendo, setSubiendo] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const rubro = rubros?.find((r) => r.id === rubroId);

  async function subir(archivo: File | undefined) {
    if (!archivo) return;
    setError(null);
    setSubiendo(true);
    try {
      const { url } = await subirArchivo(archivo, 'comprobantes');
      setComprobante({ url, nombre: archivo.name });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo subir el comprobante.');
    } finally {
      setSubiendo(false);
    }
  }

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setEnviando(true);
    try {
      await onGuardar({
        rubroId,
        proveedorId: proveedorId === SIN_PROVEEDOR ? undefined : proveedorId,
        descripcion: descripcion.trim(),
        monto: Number(monto),
        naturaleza: naturaleza || undefined,
        comprobanteUrl: comprobante?.url,
        comprobanteNumero: comprobanteNumero.trim() || undefined,
        cuotaNumero: cuotaNumero ? Number(cuotaNumero) : undefined,
        cuotaTotal: cuotaTotal ? Number(cuotaTotal) : undefined,
      });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo guardar el gasto.');
      setEnviando(false);
    }
  }

  return (
    <Dialog open onOpenChange={(abierto) => !abierto && onCerrar()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader className="-mx-4 border-b px-4 pb-4">
          <DialogTitle>{gasto ? 'Editar gasto' : 'Agregar gasto'}</DialogTitle>
          <DialogDescription>{subtitulo}</DialogDescription>
        </DialogHeader>
        <form onSubmit={enviar} className="flex flex-col gap-4">
          <FieldGroup>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel>Rubro</FieldLabel>
                <Select value={rubroId} onValueChange={setRubroId} required>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder={rubros ? 'Elegí un rubro' : 'Cargando…'} />
                  </SelectTrigger>
                  <SelectContent>
                    {rubros?.map((r) => (
                      <SelectItem key={r.id} value={r.id}>
                        {r.nombre}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field>
                <FieldLabel>Proveedor</FieldLabel>
                <Select value={proveedorId} onValueChange={setProveedorId}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={SIN_PROVEEDOR}>Sin proveedor</SelectItem>
                    {proveedores
                      ?.filter((p) => p.activo || p.id === gasto?.proveedorId)
                      .map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.razonSocial}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </Field>
            </div>

            <Field>
              <FieldLabel htmlFor="descripcion">Descripción</FieldLabel>
              <Input
                id="descripcion"
                required
                maxLength={200}
                value={descripcion}
                onChange={(e) => setDescripcion(e.target.value)}
                placeholder="Sueldo del encargado · agosto"
              />
              <FieldDescription>Así aparece en la boleta de cada vecino.</FieldDescription>
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="monto">Monto ($)</FieldLabel>
                <Input
                  id="monto"
                  type="number"
                  required
                  min={0.01}
                  step="0.01"
                  value={monto}
                  onChange={(e) => setMonto(e.target.value)}
                />
              </Field>
              <Field>
                <FieldLabel>Naturaleza</FieldLabel>
                <Select value={naturaleza || 'rubro'} onValueChange={(v) => setNaturaleza(v === 'rubro' ? '' : (v as NaturalezaGasto))}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="rubro">
                      La del rubro
                      {rubro && ` (${NATURALEZAS_GASTO.find((n) => n.valor === rubro.naturaleza)?.etiqueta})`}
                    </SelectItem>
                    {NATURALEZAS_GASTO.map((n) => (
                      <SelectItem key={n.valor} value={n.valor}>
                        {n.etiqueta}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field>
                <FieldLabel htmlFor="numero">N° de comprobante</FieldLabel>
                <Input
                  id="numero"
                  maxLength={50}
                  value={comprobanteNumero}
                  onChange={(e) => setComprobanteNumero(e.target.value)}
                  placeholder="F. 0001-3312"
                />
              </Field>
              <Field>
                <FieldLabel>Cuota</FieldLabel>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min={1}
                    max={999}
                    aria-label="Número de cuota"
                    value={cuotaNumero}
                    onChange={(e) => setCuotaNumero(e.target.value)}
                    placeholder="1"
                  />
                  <span className="text-sm text-muted-foreground">de</span>
                  <Input
                    type="number"
                    min={1}
                    max={999}
                    aria-label="Total de cuotas"
                    value={cuotaTotal}
                    onChange={(e) => setCuotaTotal(e.target.value)}
                    placeholder="3"
                  />
                </div>
              </Field>
            </div>

            <Field>
              <FieldLabel htmlFor="comprobante">Comprobante</FieldLabel>
              {comprobante ? (
                <div className="flex items-center gap-2 rounded-lg bg-muted px-3 py-2 text-sm">
                  <FileText className="size-4 shrink-0 text-muted-foreground" />
                  <a href={comprobante.url} target="_blank" rel="noreferrer" className="min-w-0 flex-1 truncate hover:text-primary">
                    {comprobante.nombre}
                  </a>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-xs"
                    aria-label="Quitar comprobante"
                    onClick={() => setComprobante(null)}
                  >
                    <X />
                  </Button>
                </div>
              ) : (
                <Input
                  id="comprobante"
                  type="file"
                  accept="image/jpeg,image/png,image/webp,application/pdf"
                  disabled={subiendo}
                  onChange={(e) => {
                    void subir(e.target.files?.[0]);
                    e.target.value = '';
                  }}
                />
              )}
              <FieldDescription>
                {subiendo ? 'Subiendo…' : 'Factura o recibo, en imagen o PDF. Sin comprobante se puede emitir igual.'}
              </FieldDescription>
            </Field>
          </FieldGroup>

          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onCerrar} disabled={enviando}>
              Cancelar
            </Button>
            <Button type="submit" disabled={!rubroId || enviando || subiendo}>
              {enviando ? 'Guardando…' : gasto ? 'Guardar cambios' : 'Agregar gasto'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
