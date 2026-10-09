'use client';

import { Building, Search, Users, X } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { toast } from 'sonner';
import { useConsorcioActivo } from '@/components/admin/consorcio-activo';
import { EmptyState } from '@/components/empty-state';
import { PageHeader } from '@/components/page-header';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { DialogoPassword } from '@/components/vecinos/dialogo-password';
import { TablaVecinos, TablaVecinosEsqueleto } from '@/components/vecinos/tabla-vecinos';
import { VecinoDialog } from '@/components/vecinos/vecino-dialog';
import { usePedido } from '@/hooks/use-pedido';
import { usuariosService } from '@/services/usuarios';
import type { Consorcio } from '@/types/consorcio';
import type { Usuario, UsuarioCambios } from '@/types/usuario';

/** Qué diálogo está abierto y para quién. */
type Dialogo = { tipo: 'ninguno' } | { tipo: 'editar' | 'password'; vecino: Usuario };

export default function AdminVecinosPage() {
  const { consorcio } = useConsorcioActivo();
  // Otro edificio arranca de cero: sin búsqueda ni la lista anterior.
  return <VecinosDelConsorcio key={consorcio.id} consorcio={consorcio} />;
}

/**
 * Los vecinos que hoy viven en el consorcio activo. Se dan de alta desde la
 * unidad (así nadie queda sin dónde vivir); acá se corrigen sus datos y se les
 * pone una contraseña nueva.
 */
function VecinosDelConsorcio({ consorcio }: { consorcio: Consorcio }) {
  const [texto, setTexto] = useState('');
  // Se busca al enviar, no en cada tecla.
  const [buscar, setBuscar] = useState('');
  const [dialogo, setDialogo] = useState<Dialogo>({ tipo: 'ninguno' });

  const pedido = usePedido(
    `vecinos:${consorcio.id}:${buscar}`,
    () => usuariosService.listar({ consorcioId: consorcio.id, buscar: buscar || undefined }),
    'No se pudieron cargar los vecinos.',
  );
  const vecinos = pedido.datos ?? pedido.ultimo ?? null;

  async function guardar(vecino: Usuario, cambios: UsuarioCambios) {
    await usuariosService.actualizar(vecino.id, cambios);
    toast.success('Datos actualizados');
    setDialogo({ tipo: 'ninguno' });
    pedido.recargar();
  }

  async function cambiarPassword(vecino: Usuario, password: string) {
    await usuariosService.resetearPassword(vecino.id, password);
    toast.success(`Contraseña nueva para ${vecino.nombre}`);
    setDialogo({ tipo: 'ninguno' });
  }

  const irAUnidades = (
    <Button asChild variant="outline">
      <Link href="/admin/unidades">
        <Building data-icon="inline-start" />
        Sumar desde una unidad
      </Link>
    </Button>
  );

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        titulo="Vecinos"
        contexto={[consorcio.nombre, consorcio.barrio].filter(Boolean).join(' · ')}
        descripcion={
          vecinos && !buscar
            ? `${vecinos.length} ${vecinos.length === 1 ? 'vecino vive' : 'vecinos viven'} hoy en el edificio`
            : 'Los vecinos se suman desde su unidad, como propietarios o inquilinos.'
        }
        acciones={irAUnidades}
      />

      {pedido.error ? (
        <Alert variant="destructive">
          <AlertDescription>{pedido.error}</AlertDescription>
        </Alert>
      ) : vecinos && vecinos.length === 0 && !buscar ? (
        <EmptyState
          icono={Users}
          titulo="Todavía no hay vecinos"
          descripcion="Entrá a una unidad y sumá a quien vive ahí: con su cuenta, si ya tiene, o dándolo de alta."
          accion={irAUnidades}
        />
      ) : (
        <Card className="gap-0 py-0">
          <form
            className="flex flex-wrap items-center gap-2 border-b px-4 py-3"
            onSubmit={(e) => {
              e.preventDefault();
              setBuscar(texto.trim());
            }}
          >
            <Input
              type="search"
              aria-label="Buscar vecino"
              placeholder="Nombre, apellido o email"
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              className="min-w-0 flex-1 sm:max-w-sm"
            />
            <Button type="submit" variant="outline">
              <Search data-icon="inline-start" />
              Buscar
            </Button>
            {buscar && (
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setTexto('');
                  setBuscar('');
                }}
              >
                <X data-icon="inline-start" />
                Limpiar
              </Button>
            )}
          </form>

          {!vecinos ? (
            <TablaVecinosEsqueleto />
          ) : vecinos.length === 0 ? (
            <p className="px-4 py-10 text-center text-sm text-muted-foreground">Nadie coincide con “{buscar}”.</p>
          ) : (
            <TablaVecinos
              vecinos={vecinos}
              onEditar={(vecino) => setDialogo({ tipo: 'editar', vecino })}
              onPassword={(vecino) => setDialogo({ tipo: 'password', vecino })}
            />
          )}
        </Card>
      )}

      {dialogo.tipo === 'editar' && (
        <VecinoDialog
          vecino={dialogo.vecino}
          onGuardar={(cambios) => guardar(dialogo.vecino, cambios)}
          onCerrar={() => setDialogo({ tipo: 'ninguno' })}
        />
      )}
      {dialogo.tipo === 'password' && (
        <DialogoPassword
          vecino={dialogo.vecino}
          onGuardar={(password) => cambiarPassword(dialogo.vecino, password)}
          onCerrar={() => setDialogo({ tipo: 'ninguno' })}
        />
      )}
    </div>
  );
}
