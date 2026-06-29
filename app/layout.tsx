import type { Metadata } from "next"
import { Outfit, Inter } from "next/font/google"
import "./globals.css"
import { TracksProvider } from "@/hooks/tracks-store"
import { Toaster } from "@/components/ui/toaster"

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
  weight: ["400", "600", "700", "800"],
})

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
})

export const metadata: Metadata = {
  title: "SonglessUnlimited",
  description: "Guess the song from short audio clips",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className="dark">
      <body className={`${outfit.variable} ${inter.variable} font-sans antialiased bg-[#020617] text-[#dce5d9]`}>
        <TracksProvider>
          {children}
        </TracksProvider>
        <Toaster />
      </body>
    </html>
  )
}
