import { useNavigate } from "react-router-dom"
import { useTranslation } from "react-i18next"
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
  const { t } = useTranslation()
  usePageTitle(t('pageTitle.notFound'))
  const navigate = useNavigate()

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Empty className="border border-dashed max-w-lg">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <SearchIcon />
          </EmptyMedia>
          <EmptyTitle>{t('notFound.title')}</EmptyTitle>
          <EmptyDescription>
            {t('notFound.description')}
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <InputGroup className="w-full sm:w-3/4">
            <InputGroupInput placeholder={t('notFound.searchPlaceholder')} />
            <InputGroupAddon>
              <SearchIcon className="size-4" />
            </InputGroupAddon>
          </InputGroup>
          <EmptyDescription>
            <a href="https://moddy.app/support" target="_blank" rel="noopener noreferrer">
              {t('notFound.contactSupport')}
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
          {t('notFound.backToDashboard')}
        </Button>
      </Empty>
    </div>
  )
}
