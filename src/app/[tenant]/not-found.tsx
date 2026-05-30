export default function TenantNotFound() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center p-8">
      <h1 className="text-2xl font-bold">Empresa no encontrada</h1>
      <p className="mt-2 text-zinc-500">
        El subdominio no corresponde a ninguna empresa registrada,
        o no tienes acceso a este espacio de trabajo.
      </p>
    </main>
  );
}
