// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// External react-bootstrap components from Mattermost's global ReactBootstrap
declare const ReactBootstrap: any;

// Get ReactBootstrap from global scope
const getReactBootstrap = () => {
    // Try to get ReactBootstrap from global scope (provided by Mattermost webapp)
    if (typeof window !== 'undefined' && (window as any).ReactBootstrap) {
        return (window as any).ReactBootstrap;
    }

    // Try to get ReactBootstrap from global scope (alternative access)
    if (typeof ReactBootstrap !== 'undefined') {
        return ReactBootstrap;
    }

    // Try to get ReactBootstrap from global scope (Node.js test environment)
    if (typeof global !== 'undefined' && (global as any).ReactBootstrap) {
        return (global as any).ReactBootstrap;
    }

    // Throw an error if ReactBootstrap is not available
    throw new Error('ReactBootstrap is not available. Make sure it is loaded in the environment.');
};

const ReactBootstrapComponents = getReactBootstrap();

export const Modal = ReactBootstrapComponents.Modal;
export const Button = ReactBootstrapComponents.Button;
export const Form = ReactBootstrapComponents.Form;
export const InputGroup = ReactBootstrapComponents.InputGroup;
export const FormControl = ReactBootstrapComponents.FormControl;
export const Dropdown = ReactBootstrapComponents.Dropdown;
export const DropdownButton = ReactBootstrapComponents.DropdownButton;
export const DropdownToggle = ReactBootstrapComponents.DropdownToggle;
export const DropdownMenu = ReactBootstrapComponents.DropdownMenu;
export const DropdownItem = ReactBootstrapComponents.DropdownItem;
export const Nav = ReactBootstrapComponents.Nav;
export const NavItem = ReactBootstrapComponents.NavItem;
export const NavLink = ReactBootstrapComponents.NavLink;
export const NavDropdown = ReactBootstrapComponents.NavDropdown;
export const Tabs = ReactBootstrapComponents.Tabs;
export const Tab = ReactBootstrapComponents.Tab;
export const Row = ReactBootstrapComponents.Row;
export const Col = ReactBootstrapComponents.Col;
export const Container = ReactBootstrapComponents.Container;
export const Card = ReactBootstrapComponents.Card;
export const CardHeader = ReactBootstrapComponents.CardHeader;
export const CardBody = ReactBootstrapComponents.CardBody;
export const CardFooter = ReactBootstrapComponents.CardFooter;
export const Badge = ReactBootstrapComponents.Badge;
export const Alert = ReactBootstrapComponents.Alert;
export const Spinner = ReactBootstrapComponents.Spinner;
export const OverlayTrigger = ReactBootstrapComponents.OverlayTrigger;
export const Tooltip = ReactBootstrapComponents.Tooltip;
export const Popover = ReactBootstrapComponents.Popover;

