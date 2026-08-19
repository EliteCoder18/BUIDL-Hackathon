import "./styles.css";

export const metadata = { title: "TrustFutures", description: "Reliability market for AI agents" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
