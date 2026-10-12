import { toast } from 'sonner';
import { ApiError } from '@/lib/api';
import { votacionesService } from '@/services/votaciones';
import type { VotacionInput } from '@/types/votacion';

/**
 * El alta de una votación, con "Publicar votación" si se pidió. Si se crea
 * pero no se puede publicar, no se relanza: el diálogo se cierra (un segundo
 * intento la duplicaría) y queda en borrador, con el motivo en un toast.
 */
export async function crearVotacion(input: VotacionInput, publicar: boolean): Promise<void> {
  const { id } = await votacionesService.crear(input);
  if (!publicar) {
    toast.success('Votación guardada en borrador');
    return;
  }
  try {
    await votacionesService.publicar(id);
    toast.success('Votación publicada: los vecinos ya pueden votar');
  } catch (err) {
    toast.error(
      `Quedó en borrador: ${err instanceof ApiError ? err.message : 'no se pudo publicar la votación.'}`,
    );
  }
}
