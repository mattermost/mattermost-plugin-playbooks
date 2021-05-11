import {GlobalState} from 'mattermost-redux/types/store';
import {getLicense, getConfig} from 'mattermost-redux/selectors/entities/general';

// isE20LicensedOrDevelopment returns true when the server is licensed with a Mattermost
// Enterprise E20 License, or has `EnableDeveloper` and `EnableTesting` configuration settings
// enabled, signaling a non-production, developer mode.
export const isE20LicensedOrDevelopment = (state: GlobalState): boolean => {
    const license = getLicense(state);

    // Use the presence of a known e20 feature as a check to determine licensing.
    if (license?.MessageExport === 'true') {
        return true;
    }

    return isConfiguredForDevelopment(state);
};

// isE10LicensedOrDevelopment returns true when the server is licensed with a Mattermost
// Enterprise E10 License, or has `EnableDeveloper` and `EnableTesting` configuration settings
// enabled, signaling a non-production, developer mode.
export const isE10LicensedOrDevelopment = (state: GlobalState): boolean => {
    const license = getLicense(state);

    // Use the presence of a known E10 feature as a check to determine licensing.
    if (license?.LDAP === 'true') {
        return true;
    }

    return isConfiguredForDevelopment(state);
};

export const isConfiguredForDevelopment = (state: GlobalState): boolean => {
    const config = getConfig(state);

    return config.EnableTesting === 'true' && config.EnableDeveloper === 'true';
};

export const isEnterpriseEdition = (state: GlobalState): boolean => {
    const config = getConfig(state);

    return config.BuildEnterpriseReady === 'true';
};

export const isCloud = (state: GlobalState): boolean => {
    const license = getLicense(state);

    return license?.Cloud === 'true';
};

export const isPricingPlanDifferentiationEnabled = (state: GlobalState): boolean => {
    if (isCloud(state)) {
        return false;
    }

    if (!isEnterpriseEdition(state)) {
        return false;
    }

    return true;
};
