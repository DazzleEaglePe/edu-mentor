import { redirect } from 'next/navigation';

export default function RootPage() {
  // El portal entra por Inicio: es la pantalla que responde "qué sigue".
  redirect('/inicio');
}
