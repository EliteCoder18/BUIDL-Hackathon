import "./styles.css";
import { Providers } from "./providers";
import { AppFrame } from "../components/ui/AppFrame";

export const metadata = { title: "TrustFutures", description: "Reliability market for AI agents" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body><Providers><AppFrame>{children}</AppFrame></Providers></body></html>;
}
