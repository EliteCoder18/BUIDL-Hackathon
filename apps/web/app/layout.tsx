import "./styles.css";
import { Providers } from "./providers";

export const metadata = { title: "TrustFutures", description: "Reliability market for AI agents" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body><Providers>{children}</Providers></body></html>;
}
