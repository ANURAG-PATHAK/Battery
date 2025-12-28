import { rulesConfig, RuleIds, type RuleId } from '../rules/rules.config';
import type { RuleImpact } from './batteryHealth.service';

export type DriverTip = {
  id: RuleId;
  message: string;
};

const buildTip = (id: RuleId, template: { message: string }): DriverTip => ({
  id,
  message: template.message,
});

export const buildDriverTipsFromImpacts = (impacts: RuleImpact[]): DriverTip[] =>
  impacts.reduce<DriverTip[]>((accumulator, impact) => {
    let tipTemplate: { message: string } | undefined;

    switch (impact.id) {
      case RuleIds.deepDischargeWarning:
        tipTemplate = rulesConfig.deepDischarge.warning.tip;
        break;
      case RuleIds.deepDischargeCritical:
        tipTemplate = rulesConfig.deepDischarge.critical.tip;
        break;
      case RuleIds.idleDrain:
        tipTemplate = rulesConfig.idleDrain.tip;
        break;
      case RuleIds.rapidDrop:
        tipTemplate = rulesConfig.rapidDrop.tip;
        break;
      case RuleIds.slowCharge:
        tipTemplate = rulesConfig.slowCharge.tip;
        break;
      case RuleIds.temperatureHigh:
        tipTemplate = rulesConfig.temperature.highTip;
        break;
      case RuleIds.temperatureLow:
        tipTemplate = rulesConfig.temperature.lowTip;
        break;
      default:
        break;
    }

    if (tipTemplate) {
      accumulator.push(buildTip(impact.id, tipTemplate));
    }

    return accumulator;
  }, []);
