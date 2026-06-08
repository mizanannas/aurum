import LiveTicker from '@/components/dashboard/LiveTicker';
import PriceChart from '@/components/dashboard/PriceChart';
import TechnicalSignals from '@/components/dashboard/TechnicalSignals';
import SentimentMeter from '@/components/dashboard/SentimentMeter';
import PredictionCard from '@/components/dashboard/PredictionCard';

export default function DashboardPage() {
  return (
    <div className="dashboard-root">
      {/* Header */}
      <header className="dashboard-header">
        <div className="brand">
          <span className="brand-icon">◈</span>
          <span className="brand-name">AURUM</span>
          <span className="brand-tag">XAUUSD Intelligence</span>
        </div>
        <LiveTicker />
        <div className="header-right">
          <div className="connection-status">
            <span className="dot-pulse" />
            <span>Connected</span>
          </div>
        </div>
      </header>

      {/* Main grid */}
      <main className="dashboard-grid">
        {/* Chart - takes 2/3 */}
        <div className="grid-chart">
          <PriceChart />
        </div>

        {/* Prediction - takes 1/3 */}
        <div className="grid-prediction">
          <PredictionCard />
        </div>

        {/* Technical signals */}
        <div className="grid-technical">
          <TechnicalSignals />
        </div>

        {/* Sentiment */}
        <div className="grid-sentiment">
          <SentimentMeter />
        </div>
      </main>
    </div>
  );
}
