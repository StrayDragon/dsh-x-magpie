import { type MagpieApi, type PluginConfig, type RouteCandidate, type RouteDiff, type RouteModel } from './shared.js';
export { name } from './identity.js';
export declare const inject: readonly ['webServer', 'configEditor', 'credentials'];
/** Raw row of the magpie gateway's `GET /v1/models` answer. */
interface GatewayRow {
    id?: unknown;
    display_name?: unknown;
    name?: unknown;
    context_window?: unknown;
    context_length?: unknown;
    max_output_tokens?: unknown;
    reasoning?: unknown;
    supported_reasoning_levels?: unknown;
    modalities?: {
        input?: unknown;
    };
    owned_by?: unknown;
    [key: string]: unknown;
}
/** Loader entry handle, as handed to configEditor.edit. */
interface LoaderEntry {
    options?: {
        id?: string;
    };
    id?: string;
}
/** Minimal surface of the dsh services this plugin touches. */
interface HostContext {
    effect(register: () => () => void, label: string): () => void;
    webServer: {
        register(route: {
            kind: 'prefix';
            path: string;
            handler: (req: IncomingLike, res: ResponseLike) => Promise<void> | void;
        }): () => void;
    };
    configEditor: {
        entries(): LoaderEntry[];
        configuration(): Array<{
            entry: LoaderEntry;
            inherited: Record<string, unknown>;
            override: Record<string, unknown>;
        }>;
        edit(entry: LoaderEntry, change: (current: Record<string, unknown>, inherited: Record<string, unknown>) => Record<string, unknown>): Promise<void>;
    };
    credentials: {
        resolve(ref: string): Promise<{
            value?: string;
        } | undefined>;
        set(ref: string, value: string): Promise<void>;
    };
}
interface IncomingLike {
    method?: string;
    url?: string;
    headers: Record<string, unknown>;
    on(event: string, listener: (chunk?: unknown) => void): unknown;
}
interface ResponseLike {
    writeHead(status: number, headers: Record<string, string>): unknown;
    end(body: string): unknown;
}
export declare function readConfig(config: Record<string, unknown> | undefined): PluginConfig;
/** One gateway row onto one llm-pi-ai model entry. `null` overrides drop fields. */
export declare function mapModel(row: GatewayRow, overrides: PluginConfig['modelOverrides']): RouteModel | undefined;
/** Field-level diff of the route this plugin manages. Other routes never appear. */
export declare function diffRoute(current: unknown, candidate: RouteCandidate): RouteDiff;
interface PlanShape {
    gatewayUrl: string;
    routeName: string;
    routePresent: boolean;
    modelCount: number;
    models: Array<{
        id: string;
        provider?: string;
        contextWindow?: number;
        maxTokens?: number;
    }>;
    diff: RouteDiff;
    warning?: string;
}
export declare function planSync(ctx: HostContext, cfg: PluginConfig): Promise<PlanShape | {
    error: string;
}>;
export declare function applySync(ctx: HostContext, cfg: PluginConfig): Promise<{
    ok: true;
    routeName: string;
    written: number;
    diff: RouteDiff;
} | {
    error: string;
}>;
/** Remove the route this plugin owns. Other routes are never touched. */
export declare function removeSync(ctx: HostContext, cfg: PluginConfig): Promise<{
    ok: true;
    removed: boolean;
} | {
    error: string;
}>;
export interface PluginState {
    gatewayUrl: string;
    routeName: string;
    displayName: string;
    credentialRef: string;
    api: MagpieApi;
    exclude: string[];
    hasCredential: boolean;
    gatewayMounted: boolean;
    gatewayMessage: string | null;
    routePresent: boolean;
    routeModelCount: number;
}
export declare function readState(ctx: HostContext, cfg: PluginConfig): Promise<PluginState>;
export declare function storeKey(ctx: HostContext, cfg: PluginConfig, value: unknown): Promise<{
    ok: true;
    credentialRef: string;
} | {
    error: string;
}>;
/** Validate settings-page config edits onto this plugin's own row. */
export declare function normalizeConfigPatch(body: Record<string, unknown>): {
    updates: Partial<Record<string, unknown>>;
} | {
    error: string;
};
export declare function updateConfig(ctx: HostContext, body: Record<string, unknown>): Promise<{
    ok: true;
    applied: Record<string, unknown>;
} | {
    error: string;
}>;
/** The apply() export: one effect for the same-origin HTTP surface. */
export declare function apply(ctx: HostContext, config: Record<string, unknown> | undefined): void;
//# sourceMappingURL=index.d.ts.map