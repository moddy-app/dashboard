import { useNavigate } from "react-router-dom"
import { SearchIcon, ArrowLeftIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group"
import { usePageTitle } from "@/hooks/usePageTitle"

export function NotFoundPage() {
  usePageTitle("404 - Page introuvable")
  const navigate = useNavigate()

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Empty className="border border-dashed max-w-lg">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <SearchIcon />
          </EmptyMedia>
          <EmptyTitle>404 — Page introuvable</EmptyTitle>
          <EmptyDescription>
            La page que vous cherchez n&apos;existe pas ou a été déplacée.
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <InputGroup className="w-full sm:w-3/4">
            <InputGroupInput placeholder="Rechercher une page..." />
            <InputGroupAddon>
              <SearchIcon className="size-4" />
            </InputGroupAddon>
          </InputGroup>
          <EmptyDescription>
            Besoin d&apos;aide ?{" "}
            <a href="https://moddy.app/support" target="_blank" rel="noopener noreferrer">
              Contacter le support
            </a>
          </EmptyDescription>
        </EmptyContent>
        <Button
          variant="outline"
          size="sm"
          onClick={() => navigate("/")}
          className="mt-2"
        >
          <ArrowLeftIcon className="size-4" />
          Retour au dashboard
        </Button>
      </Empty>
    </div>
  )
}
