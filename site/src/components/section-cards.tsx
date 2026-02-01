import { IconTrendingDown, IconTrendingUp } from "@tabler/icons-react"

import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

export function SectionCards() {
  return (
    <div className="*:data-[slot=card]:shadow-xs grid grid-cols-1 gap-4 px-4 *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card dark:*:data-[slot=card]:bg-card lg:px-6 @xl/main:grid-cols-2 @5xl/main:grid-cols-4">
      <Card className="@container/card" data-slot="card">
        <CardHeader className="relative">
          <CardDescription>Total Revenue</CardDescription>
          <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
            $1,250.00
          </CardTitle>
          <div className="absolute right-4 top-4">
            <Badge variant="outline" className="flex gap-1 rounded-lg text-xs">
              <IconTrendingUp className="size-3" />
              +12.5%
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-xs text-muted-foreground">
            Trending up by 12.5% this month
          </div>
          <div className="text-xs text-muted-foreground">
            January - June 2024
          </div>
        </CardContent>
      </Card>
      <Card className="@container/card" data-slot="card">
        <CardHeader className="relative">
          <CardDescription>New Customers</CardDescription>
          <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
            1,234
          </CardTitle>
          <div className="absolute right-4 top-4">
            <Badge variant="outline" className="flex gap-1 rounded-lg text-xs">
              <IconTrendingDown className="size-3" />
              -20%
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-xs text-muted-foreground">
            Down 20% from last month
          </div>
          <div className="text-xs text-muted-foreground">
            Acquisition needs attention
          </div>
        </CardContent>
      </Card>
      <Card className="@container/card" data-slot="card">
        <CardHeader className="relative">
          <CardDescription>Active Accounts</CardDescription>
          <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
            45,678
          </CardTitle>
          <div className="absolute right-4 top-4">
            <Badge variant="outline" className="flex gap-1 rounded-lg text-xs">
              <IconTrendingUp className="size-3" />
              +12.5%
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-xs text-muted-foreground">
            Strong user retention
          </div>
          <div className="text-xs text-muted-foreground">
            Engagement exceed targets
          </div>
        </CardContent>
      </Card>
      <Card className="@container/card" data-slot="card">
        <CardHeader className="relative">
          <CardDescription>Growth Rate</CardDescription>
          <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
            4.5%
          </CardTitle>
          <div className="absolute right-4 top-4">
            <Badge variant="outline" className="flex gap-1 rounded-lg text-xs">
              <IconTrendingUp className="size-3" />
              +4.5%
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-xs text-muted-foreground">
            Steady performance increase
          </div>
          <div className="text-xs text-muted-foreground">
            Meets growth projections
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
