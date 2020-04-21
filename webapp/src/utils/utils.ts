import {UserProfile} from 'mattermost-redux/types/users';

const MOBILE_SCREEN_WIDTH = 768;

export const getDisplayName = (user: UserProfile): string => {
    if (user.first_name && user.last_name) {
        return `${user.first_name} ${user.last_name}`;
    }

    return `@${user.username}`;
};

export const getFullName = (firstName: string, lastName: string): string => {
    if (firstName && lastName) {
        return firstName + ' ' + lastName;
    } else if (firstName) {
        return firstName;
    } else if (lastName) {
        return lastName;
    }

    return '';
};

export const getUserDescription = (firstName: string, lastName: string, nickName: string): string => {
    if ((firstName || lastName) && nickName) {
        return ` ${getFullName(firstName, lastName)} (${nickName})`;
    } else if (nickName) {
        return ` (${nickName})`;
    } else if (firstName || lastName) {
        return ` ${getFullName(firstName, lastName)}`;
    }

    return '';
};

export const isMobile = () => {
    return window.innerWidth <= MOBILE_SCREEN_WIDTH;
};
