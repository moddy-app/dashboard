export function App() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-8">
      <div className="max-w-md text-center">
        {/* Error Icon */}
        <div className="mb-6 flex justify-center">
          <svg
            className="h-20 w-20 text-destructive"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
        </div>

        {/* Error Message */}
        <h1 className="mb-4 text-3xl font-bold text-foreground">
          Dashboard Unavailable
        </h1>
        <p className="mb-2 text-lg text-muted-foreground">
          The Moddy Dashboard is currently under active development.
        </p>
        <p className="text-sm text-muted-foreground">
          Please check back later for updates.
        </p>

        {/* Additional Info */}
        <div className="mt-8 rounded-lg border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground">
            For more information about Moddy, please visit our Discord community.
          </p>
        </div>
      </div>
    </div>
  )
}

export default App