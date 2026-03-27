import "./globals.css";

export const metadata = {
  title: "Diagrama.ai | Mapeamento BPMN Inteligente",
  description: "Da sua mente para a tela em segundos, construídos por IA.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
