/** Shared types and helpers for the dsh-x-magpie host and client halves. */

/** Wire protocols the synced route may speak to the magpie gateway. */
export type MagpieApi = 'openai-completions' | 'openai-responses' | 'anthropic-messages';

/** llm-pi-ai accepts exactly these request modalities in a model profile. */
export const ROUTE_MODALITIES = ['text', 'image'] as const;

/** pi-ai reasoning-level vocabulary; anything else the gateway reports is dropped. */
export const REASONING_LEVELS = ['off', 'minimal', 'low', 'medium', 'high', 'xhigh', 'max'] as const;

/** Defaults for every configurable field; the shipped patch mirrors these. */
export const DEFAULTS = {
	gatewayUrl: 'http://127.0.0.1:3425',
	routeName: 'magpie',
	displayName: 'Magpie (from dsh-x-magpie)',
	credentialRef: 'MAGPIE_GATEWAY_KEY',
	api: 'openai-responses',
	modelOverrides: {},
	exclude: [],
} as const;

/** Plugin identity, shared by the loader row, the client module id, and the HTTP prefix. */
export const PLUGIN_ID = 'dsh-x-magpie';
export const PLUGIN_PACKAGE = '@straydragon/dsh-x-magpie';
/** Host-side HTTP namespace, served same-origin under the web origin. */
export const ROUTE_PREFIX = `/${PLUGIN_ID}`;

/** Resolved, validated plugin configuration after defaults and normalization. */
export interface PluginConfig {
	gatewayUrl: string;
	routeName: string;
	displayName: string;
	credentialRef: string;
	api: MagpieApi;
	modelOverrides: Record<string, Record<string, unknown>>;
	exclude: string[];
}

/** One model entry as it is written into the llm-pi-ai route. Absent fields
 * stay absent: llm-pi-ai then applies its own defaults. */
export interface RouteModel {
	id: string;
	name?: string;
	contextWindow?: number;
	maxTokens?: number;
	input?: string[];
	reasoningEfforts?: Record<string, string> | false;
}

/** The route object written into llm-pi-ai's `providers` dict. */
export interface RouteCandidate {
	displayName: string;
	api: MagpieApi;
	baseURL: string;
	apiKeyEnv: string;
	models: RouteModel[];
}

/** Field-level route diff: `null` means "not set before". */
export interface RouteDiff {
	route: Array<{ field: string; from: unknown; to: unknown }>;
	added: string[];
	removed: string[];
	changed: Array<{ id: string; fields: Array<{ field: string; from: unknown; to: unknown }> }>;
	unchanged: number;
}

/** One row of the model-selection checklist. */
export interface CatalogModel {
	id: string;
	provider?: string;
	contextWindow?: number;
	maxTokens?: number;
}

/** Result shared by the plan and apply endpoints. */
export interface SyncResult {
	gatewayUrl: string;
	routeName: string;
	routePresent: boolean;
	modelCount: number;
	models: CatalogModel[];
	diff: RouteDiff;
	warning?: string;
}
