import { Component, ErrorInfo, ReactNode } from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  moduleName?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error(`[ErrorBoundary] Terjadi kesalahan pada komponen ${this.props.moduleName || 'aplikasi'}:`, error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  private handleReload = () => {
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-[280px] p-6 sm:p-8 flex items-center justify-center">
          <div className="bg-[#FBF9F4] border border-[#1B4332]/15 rounded-3xl p-6 sm:p-8 max-w-lg w-full text-center shadow-lg space-y-4">
            <div className="w-12 h-12 bg-rose-100 text-rose-700 rounded-2xl flex items-center justify-center mx-auto">
              <AlertCircle className="w-6 h-6" />
            </div>

            <div className="space-y-1.5">
              <h3 className="text-base sm:text-lg font-bold font-display text-[#1C2321]">
                Terjadi Kendala Memuat Data {this.props.moduleName || 'Halaman'}
              </h3>
              <p className="text-xs text-[#6B7A72] leading-relaxed">
                Mohon maaf, sistem mendeteksi kendala sementara pada tampilan ini.
              </p>
              {this.state.error?.message && (
                <div className="p-2.5 bg-rose-50 border border-rose-200/70 rounded-xl text-rose-800 text-[11px] font-mono break-all text-left mt-2">
                  {this.state.error.message}
                </div>
              )}
            </div>

            <div className="flex items-center justify-center gap-2 pt-2">
              <button
                type="button"
                onClick={this.handleReset}
                className="px-4 py-2 bg-[#1B4332] hover:bg-[#14352A] text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Coba Lagi</span>
              </button>
              <button
                type="button"
                onClick={this.handleReload}
                className="px-4 py-2 bg-[#F2EEE4] hover:bg-[#EAE4D6] text-[#1B4332] rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all border border-[#1B4332]/15"
              >
                <span>Muat Ulang Halaman</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
