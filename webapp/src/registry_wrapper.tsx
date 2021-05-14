import {Store} from 'redux';

//@ts-ignore Webapp imports don't work properly
import {PluginRegistry} from 'mattermost-webapp/plugins/registry';
import {GlobalState} from 'mattermost-redux/types/store';

// RegistryWrapper intercepts component and event handling registrations with the WebApp
// PluginAPI, making it easy to unregister everything at once.
//
// There is already functionality in the WebApp to do this on plugin unregistration, but it's
// not currently exposed in a way that plugins can use directly.
//
// To use:
//   const registryWrapper = new RegistryWrapper(registry, store);
//   registryWrapper.register...
//
// To unregister:
//   registryWrapper.unregister();
//
// The API is intentionally incompletely, encompassing only those registrations required by this
// plugin.
class RegistryWrapper {
    private registry: PluginRegistry;
    private store: Store<GlobalState>;
    private unregisterCallbacks: (() => void)[];

    public constructor(registry: PluginRegistry, store: Store<GlobalState>) {
        this.registry = registry;
        this.store = store;
        this.unregisterCallbacks = [];
    }

    unregister = () => {
        this.unregisterCallbacks.forEach((callback) => callback());
        this.unregisterCallbacks = [];
    }

    subscribe = (callback: any) => {
        const unsubscribe = this.store.subscribe(callback);
        this.unregisterCallbacks.push(unsubscribe);

        return unsubscribe;
    }

    registerRightHandSidebarComponent = (...args: any[]) => {
        const {id, hideRHSPlugin, ...rest} = this.registry.registerRightHandSidebarComponent(...args);
        this.unregisterCallbacks.push(() => {
            this.store.dispatch(hideRHSPlugin);
            this.registry.unregisterComponent(id);
        });

        return {id, hideRHSPlugin, ...rest};
    }

    registerChannelHeaderButtonAction = (...args: any[]) => {
        const id = this.registry.registerChannelHeaderButtonAction(...args);
        this.unregisterCallbacks.push(() => this.registry.unregisterComponent(id));
    }

    registerPostDropdownMenuComponent = (...args: any[]) => {
        const id = this.registry.registerPostDropdownMenuComponent(...args);
        this.unregisterCallbacks.push(() => this.registry.unregisterComponent(id));
    }

    registerReconnectHandler = (...args: any[]) => {
        this.registry.registerReconnectHandler(...args);
        this.unregisterCallbacks.push(() => this.registry.unregisterReconnectHandler());
    }

    registerWebSocketEventHandler = (...args: any[]) => {
        const event = args[0];
        this.registry.registerWebSocketEventHandler(...args);
        this.unregisterCallbacks.push(() => this.registry.unregisterWebSocketEventHandler(event));
    }

    registerSlashCommandWillBePostedHook = (...args: any[]) => {
        const id = this.registry.registerSlashCommandWillBePostedHook(...args);
        this.unregisterCallbacks.push(() => this.registry.unregisterComponent(id));
    }

    registerNeedsTeamRoute = (...args: any[]) => {
        const id = this.registry.registerNeedsTeamRoute(...args);
        this.unregisterCallbacks.push(() => this.registry.unregisterComponent(id));
    }

    registerRootComponent = (...args: any[]) => {
        const id = this.registry.registerRootComponent(...args);
        this.unregisterCallbacks.push(() => this.registry.unregisterComponent(id));
    }
}

export default RegistryWrapper;
