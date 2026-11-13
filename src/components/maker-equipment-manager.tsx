import { logPrinterMaintenance, saveMakerPrinter, suggestPrinterModelAction } from "@/app/painel/maker/actions";
import { formatBrl } from "@/lib/money";
import { getBrazilianCalendarDate, getMaintenanceReminders } from "@/lib/maintenance-reminders";

type PrinterModel = { id: string; manufacturer: string; model: string; variant: string };
type MaintenanceEvent = { id: string; performed_at: string; created_at: string; maintenance_type: string; component: string; cost_brl: number | string; hours_at_event: number | string | null; notes: string; next_due_at: string | null; next_due_hours: number | string | null };
type MakerPrinter = {
  id: string; catalog_model_id: string | null; manufacturer_snapshot: string; model_snapshot: string; variant_snapshot: string;
  custom_manufacturer: string | null; custom_model: string | null; nickname: string; purchased_at: string | null;
  purchase_price_brl: number | string | null; residual_value_brl: number | string | null; useful_life_hours: number | string | null;
  accumulated_hours: number | string; installed_nozzle: string | null; modifications: string; measured_average_power_w: number | string | null;
  power_measurement_conditions: string | null; energy_tariff_per_kwh: number | string | null; operational_status: string;
  maintenance: MaintenanceEvent[];
};

const statusLabel: Record<string, string> = { available: "Disponível", maintenance: "Em manutenção", inactive: "Inativa" };
const maintenanceLabel: Record<string, string> = { preventive: "Preventiva", corrective: "Corretiva", nozzle_replacement: "Troca de bico", belt_replacement: "Troca de correias", lubrication: "Lubrificação", bed_replacement: "Troca de mesa", component_replacement: "Substituição de componentes", other: "Outra" };
const dateLabel = (value: string | null) => value ? new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium", timeZone: "UTC" }).format(new Date(`${value.slice(0, 10)}T00:00:00Z`)) : "—";

function PrinterForm({ storeId, models, printer }: { storeId: string; models: PrinterModel[]; printer?: MakerPrinter }) {
  return <details className="equipment-edit-form">
    <summary>{printer ? "Editar dados e custos" : "Cadastrar equipamento"}</summary>
    <form className="auth-form equipment-form" action={saveMakerPrinter}>
      <input type="hidden" name="storeId" value={storeId} />
      {printer && <input type="hidden" name="equipmentId" value={printer.id} />}
      <label>Modelo do catálogo<select name="catalogModelId" defaultValue={printer?.catalog_model_id ?? ""}>
        <option value="">Minha impressora não está no catálogo</option>
        {printer?.catalog_model_id && !models.some((model) => model.id === printer.catalog_model_id) && <option value={printer.catalog_model_id}>{printer.manufacturer_snapshot} {printer.model_snapshot} {printer.variant_snapshot} (arquivado)</option>}
        {models.map((model) => <option key={model.id} value={model.id}>{model.manufacturer} {model.model} · {model.variant}</option>)}
      </select></label>
      <p className="equipment-form-hint">Ao usar um modelo do catálogo, os campos de marca e modelo próprio devem ficar vazios. Se não encontrar sua máquina, informe esses campos abaixo.</p>
      <div className="equipment-form-grid">
        <label>Fabricante próprio<input name="customManufacturer" maxLength={80} defaultValue={printer?.custom_manufacturer ?? ""} /></label>
        <label>Modelo próprio<input name="customModel" maxLength={80} defaultValue={printer?.custom_model ?? ""} /></label>
        <label>Apelido na oficina<input name="nickname" minLength={2} maxLength={80} defaultValue={printer?.nickname ?? ""} required /></label>
        <label>Estado<select name="status" defaultValue={printer?.operational_status ?? "available"}><option value="available">Disponível</option><option value="maintenance">Em manutenção</option><option value="inactive">Inativa</option></select></label>
        <label>Data da compra<input type="date" name="purchasedAt" defaultValue={printer?.purchased_at ?? ""} /></label>
        <label>Valor pago (R$)<input name="purchasePriceBrl" inputMode="decimal" placeholder="Ex.: 4500,00" defaultValue={printer?.purchase_price_brl ?? ""} /></label>
        <label>Valor residual (R$)<input name="residualValueBrl" inputMode="decimal" placeholder="Ex.: 900,00" defaultValue={printer?.residual_value_brl ?? ""} /></label>
        <label>Vida útil estimada (horas)<input name="usefulLifeHours" inputMode="decimal" placeholder="Ex.: 8000" defaultValue={printer?.useful_life_hours ?? ""} /></label>
        <label>Horas acumuladas<input name="accumulatedHours" inputMode="decimal" defaultValue={printer?.accumulated_hours ?? "0"} /></label>
        <label>Bico instalado<input name="installedNozzle" maxLength={100} placeholder="Ex.: aço temperado, 0,4 mm" defaultValue={printer?.installed_nozzle ?? ""} /></label>
        <label>Potência média medida (W)<input name="averagePowerWatts" inputMode="decimal" placeholder="Não use a potência nominal" defaultValue={printer?.measured_average_power_w ?? ""} /></label>
        <label>Tarifa de energia (R$/kWh)<input name="energyTariffPerKwh" inputMode="decimal" placeholder="Ex.: 0,89" defaultValue={printer?.energy_tariff_per_kwh ?? ""} /></label>
      </div>
      <label>Condições da medição de potência<textarea name="powerConditions" maxLength={500} rows={2} defaultValue={printer?.power_measurement_conditions ?? ""} /></label>
      <label>Modificações e acessórios<textarea name="modifications" maxLength={1000} rows={2} defaultValue={printer?.modifications ?? ""} /></label>
      <button className="button button-primary" type="submit">{printer ? "Salvar alterações" : "Salvar equipamento"}</button>
    </form>
  </details>;
}

function MaintenanceForm({ printer }: { printer: MakerPrinter }) {
  return <details className="equipment-edit-form">
    <summary>Registrar manutenção</summary>
    <form className="auth-form equipment-form" action={logPrinterMaintenance}>
      <input type="hidden" name="printerId" value={printer.id} />
      <div className="equipment-form-grid">
        <label>Data<input type="date" name="performedAt" required /></label>
        <label>Tipo<select name="maintenanceType" defaultValue="preventive"><option value="preventive">Preventiva</option><option value="corrective">Corretiva</option><option value="nozzle_replacement">Troca de bico</option><option value="belt_replacement">Troca de correias</option><option value="lubrication">Lubrificação</option><option value="bed_replacement">Troca de mesa</option><option value="component_replacement">Substituição de componentes</option><option value="other">Outra</option></select></label>
        <label>Componente/serviço<input name="component" minLength={2} maxLength={100} required /></label>
        <label>Custo (R$)<input name="costBrl" inputMode="decimal" defaultValue="0" required /></label>
        <label>Horas de uso no registro<input name="hoursAtEvent" inputMode="decimal" /></label>
        <label>Próxima manutenção prevista<input type="date" name="nextDueAt" /></label>
        <label>Próxima manutenção em horas<input type="number" name="nextDueHours" min={Number(printer.accumulated_hours) + 0.01} max="99999999.99" step="0.01" inputMode="decimal" placeholder={`Acima de ${Number(printer.accumulated_hours).toLocaleString("pt-BR")} h`} /></label>
      </div>
      <label>Observações<textarea name="notes" maxLength={1000} rows={2} /></label>
      <button className="button button-secondary" type="submit">Salvar registro</button>
    </form>
  </details>;
}

export function MakerEquipmentManager({ storeId, models, printers }: { storeId: string; models: PrinterModel[]; printers: MakerPrinter[] }) {
  return <section className="account-card maker-products-card equipment-section" id="equipamentos">
    <span className="account-kicker">ATIVOS DA OFICINA</span><h2>Impressoras e manutenção</h2>
    <p className="equipment-intro">Vincule um modelo técnico ou registre uma máquina particular. Seus custos e modificações ficam separados do catálogo compartilhado. Os lembretes usam somente as previsões cadastradas pela sua loja.</p>
    <PrinterForm storeId={storeId} models={models} />
    <details className="equipment-edit-form">
      <summary>Sugerir impressora ausente do catálogo</summary>
      <form className="auth-form equipment-form" action={suggestPrinterModelAction}>
        <div className="equipment-form-grid">
          <label>Fabricante<input name="manufacturer" minLength={2} maxLength={100} required /></label>
          <label>Modelo<input name="model" maxLength={120} required /></label>
          <label>Variante<input name="variant" maxLength={80} placeholder="standard" /></label>
          <label>Tecnologia<select name="technology" defaultValue="FDM"><option>FDM</option><option>SLA</option><option>MSLA</option><option>DLP</option></select></label>
        </div>
        <label>Fonte oficial (HTTPS, opcional)<input name="sourceUrl" type="url" maxLength={2048} placeholder="https://fabricante.com/modelo" /></label>
        <label>Detalhes para identificar a variante<textarea name="notes" maxLength={1000} rows={2} /></label>
        <button className="button button-secondary" type="submit">Enviar para revisão</button>
      </form>
    </details>
    {!models.length && <p className="quote-small-note">Não há modelos mestres publicados disponíveis. Você ainda pode cadastrar sua própria máquina sem alterar o catálogo.</p>}
    {printers.length === 0 ? <p>Nenhum equipamento cadastrado nesta loja.</p> : <div className="equipment-list">
      {printers.map((printer) => {
        const reminders = getMaintenanceReminders(printer.maintenance, Number(printer.accumulated_hours), getBrazilianCalendarDate());
        return (
          <article className="equipment-card" key={printer.id}>
            <div className="quote-card-heading">
              <div><span className="account-kicker">{printer.catalog_model_id ? "MODELO DO CATÁLOGO" : "EQUIPAMENTO PRÓPRIO"}</span><h3>{printer.nickname}</h3><p className="quote-meta">{printer.manufacturer_snapshot} {printer.model_snapshot} · {printer.variant_snapshot}</p></div>
              <span className={`quote-status status-${printer.operational_status}`}>{statusLabel[printer.operational_status] ?? printer.operational_status}</span>
            </div>
            <dl className="equipment-facts">
              <div><dt>Horas acumuladas</dt><dd>{Number(printer.accumulated_hours).toLocaleString("pt-BR")} h</dd></div>
              <div><dt>Valor de aquisição</dt><dd>{printer.purchase_price_brl == null ? "Não informado" : formatBrl(printer.purchase_price_brl)}</dd></div>
              <div><dt>Vida útil</dt><dd>{printer.useful_life_hours == null ? "Não informada" : `${Number(printer.useful_life_hours).toLocaleString("pt-BR")} h`}</dd></div>
              <div><dt>Potência média medida</dt><dd>{printer.measured_average_power_w == null ? "Não medida" : `${Number(printer.measured_average_power_w).toLocaleString("pt-BR")} W`}</dd></div>
              <div><dt>Bico instalado</dt><dd>{printer.installed_nozzle || "Não informado"}</dd></div>
              <div><dt>Tarifa</dt><dd>{printer.energy_tariff_per_kwh == null ? "Não informada" : `${formatBrl(printer.energy_tariff_per_kwh)}/kWh`}</dd></div>
            </dl>
            {printer.modifications && <p className="quote-description">{printer.modifications}</p>}
            <PrinterForm storeId={storeId} models={models} printer={printer} />
            <MaintenanceForm printer={printer} />
            {reminders.length > 0 && <div className="maintenance-reminder-list" aria-label="Lembretes de manutenção">
              {reminders.map((reminder) => {
                const dateSummary = reminder.daysRemaining == null ? null : reminder.daysRemaining < 0
                  ? `Data: ${dateLabel(reminder.nextDueAt)} · vencida há ${Math.abs(reminder.daysRemaining)} dia(s)`
                  : reminder.daysRemaining === 0 ? `Data: ${dateLabel(reminder.nextDueAt)} · vence hoje`
                    : `Data: ${dateLabel(reminder.nextDueAt)} · em ${reminder.daysRemaining} dia(s)`;
                const hoursSummary = reminder.hoursRemaining == null ? null : reminder.hoursRemaining < 0
                  ? `Horímetro ${Number(printer.accumulated_hours).toLocaleString("pt-BR")} h · excedido em ${Math.abs(reminder.hoursRemaining).toLocaleString("pt-BR")} h`
                  : reminder.hoursRemaining === 0 ? `Horímetro ${Number(printer.accumulated_hours).toLocaleString("pt-BR")} h · limite atingido`
                    : `Horímetro ${Number(printer.accumulated_hours).toLocaleString("pt-BR")} h · faltam ${reminder.hoursRemaining.toLocaleString("pt-BR")} h`;
                return <div className={`maintenance-reminder${reminder.overdue ? " is-overdue" : ""}`} key={reminder.component} role={reminder.due ? "alert" : "status"}>
                  <strong>{reminder.overdue ? "Manutenção prevista vencida" : reminder.due ? "Manutenção prevista para hoje" : "Próxima manutenção registrada"} · {reminder.component}</strong>
                  <span>{[dateSummary, hoursSummary].filter(Boolean).join(" · ")}</span>
                </div>;
              })}
            </div>}
            <div className="equipment-maintenance"><h4>Histórico de manutenção</h4>{!printer.maintenance.length ? <p>Nenhum registro de manutenção.</p> : <ul>{printer.maintenance.map((event) => <li key={event.id}><div><strong>{maintenanceLabel[event.maintenance_type] ?? "Manutenção"} · {event.component}</strong><span>{dateLabel(event.performed_at)}{event.hours_at_event != null ? ` · ${Number(event.hours_at_event).toLocaleString("pt-BR")} h` : ""}{event.next_due_at ? ` · próxima: ${dateLabel(event.next_due_at)}` : ""}{event.next_due_hours != null ? ` · horímetro previsto: ${Number(event.next_due_hours).toLocaleString("pt-BR")} h` : ""}</span>{event.notes && <span>{event.notes}</span>}</div><strong>{formatBrl(event.cost_brl)}</strong></li>)}</ul>}</div>
          </article>
        );
      })}
    </div>}
  </section>;
}
