import { useQueryErrorResetBoundary } from "@tanstack/react-query";
import { Component, type ErrorInfo, type ReactNode } from "react";
import { Button } from "./atoms/Button";
import { Message } from "./atoms/Message";

function QueryErrorFallback({
  error,
  onReset,
}: {
  error: Error;
  onReset: () => void;
}) {
  return (
    <div className="flex min-h-[50dvh] items-center justify-center p-6">
      <div className="w-full max-w-md space-y-4 text-center">
        <Message variant="error">{error.message || "Something went wrong."}</Message>
        <Button variant="secondary" size="sm" onPress={onReset}>
          Try again
        </Button>
      </div>
    </div>
  );
}

type Props = { children: ReactNode };
type State = { error: Error | null };

class ErrorBoundaryInner extends Component<
  Props & { onReset: () => void },
  State
> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("QueryErrorBoundary caught:", error, info);
  }

  reset = () => {
    this.props.onReset();
    this.setState({ error: null });
  };

  render() {
    if (this.state.error) {
      return (
        <QueryErrorFallback error={this.state.error} onReset={this.reset} />
      );
    }
    return this.props.children;
  }
}

export function QueryErrorBoundary({ children }: Props) {
  const { reset } = useQueryErrorResetBoundary();
  return (
    <ErrorBoundaryInner onReset={reset}>{children}</ErrorBoundaryInner>
  );
}
