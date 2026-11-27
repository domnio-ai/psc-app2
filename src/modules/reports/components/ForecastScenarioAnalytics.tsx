import type {InstitutionalIntelligence} from '../../../api'

export default function ForecastScenarioAnalytics({data}:{data:InstitutionalIntelligence}){
  const forecast=data.overview.forecast
  if(!forecast)return null
  return <article className="forecast-scenario-analytics">
    <header>
      <div>
        <small>EXECUTIVE SCENARIO ANALYTICS</small>
        <h3>What changes under transparent management assumptions?</h3>
        <p>Planning scenarios use deterministic arithmetic on the current authorised APP2 evidence base. They do not claim statistical prediction.</p>
      </div>
      <span><small>Responsible team</small><strong>{forecast.responsibleTeam}</strong></span>
    </header>
    <div className="forecast-baseline">
      <span><small>Continuation overdue pressure</small><strong>{forecast.baseline.overdue}</strong></span>
      <span><small>Continuation review queue</small><strong>{forecast.baseline.awaitingReview}</strong></span>
      <span><small>Continuation completion rate</small><strong>{forecast.baseline.completionRate}%</strong></span>
      <span><small>Evidence strength</small><strong>{forecast.evidenceStrength}</strong></span>
    </div>
    <div className="forecast-scenario-grid">
      {forecast.scenarios.map(scenario=><section key={scenario.key}>
        <h4>{scenario.title}</h4>
        <p>{scenario.assumption}</p>
        <div>
          <span><small>Overdue</small><strong>{scenario.overdue}</strong></span>
          <span><small>Awaiting review</small><strong>{scenario.awaitingReview}</strong></span>
          <span><small>Completion rate</small><strong>{scenario.completionRate}%</strong></span>
        </div>
      </section>)}
    </div>
    <footer>{forecast.methodology}</footer>
  </article>
}
