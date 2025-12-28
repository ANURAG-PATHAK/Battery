import { rulesConfig, RuleIds, type RuleId } from '../rules/rules.config';
import type { RuleImpact } from './batteryHealth.service';

export type AlertSeverity = 'info' | 'warning' | 'critical';

export type Alert = {
  id: RuleId;
  title: string;
  message: string;
  severity: AlertSeverity;
  metadata?: Record<string, unknown>;
};

const buildAlert = (
  id: RuleId,
  template: { title: string; message: string; severity: AlertSeverity },
  metadata?: Record<string, unknown>,
): Alert => ({
  id,
  title: template.title,
  message: template.message,
  severity: template.severity,
  metadata,
});

export const buildAlertsFromImpacts = (impacts: RuleImpact[]): Alert[] =>
  impacts.reduce<Alert[]>((accumulator, impact) => {
    let alertTemplate:
      | { title: string; message: string; severity: AlertSeverity }
      | undefined;

    switch (impact.id) {
      case RuleIds.deepDischargeWarning:
        alertTemplate = rulesConfig.deepDischarge.warning.alert;
        break;
      case RuleIds.deepDischargeCritical:
        alertTemplate = rulesConfig.deepDischarge.critical.alert;
        break;
      case RuleIds.idleDrain:
        alertTemplate = rulesConfig.idleDrain.alert;
        break;
      case RuleIds.rapidDrop:
        alertTemplate = rulesConfig.rapidDrop.alert;
        break;
      case RuleIds.slowCharge:
        alertTemplate = rulesConfig.slowCharge.alert;
        break;
      case RuleIds.temperatureHigh:
        alertTemplate = rulesConfig.temperature.highAlert;
        break;
      case RuleIds.temperatureLow:
        alertTemplate = rulesConfig.temperature.lowAlert;
        break;
      default:
        break;
    }

    if (alertTemplate) {
      accumulator.push(buildAlert(impact.id, alertTemplate, impact.metadata));
    }

    return accumulator;
  }, []);
