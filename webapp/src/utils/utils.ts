import {UserProfile} from 'mattermost-redux/types/users';

const MOBILE_SCREEN_WIDTH = 768;

export const getDisplayName = (user: UserProfile): string => {
    if (user.first_name && user.last_name) {
        return `${user.first_name} ${user.last_name}`;
    }

    return `@${user.username}`;
};

export const isMobile = () => {
    return window.innerWidth <= MOBILE_SCREEN_WIDTH;
};
