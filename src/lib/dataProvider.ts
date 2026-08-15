import { DataProvider, BaseRecord, HttpError, GetListParams, GetOneParams, CreateParams, UpdateParams, DeleteOneParams, CustomParams } from '@refinedev/core';
import { apiClient, ApiClientError } from './apiClient';
import { env } from './env';

function transformError(error: unknown): HttpError {
  if (error instanceof ApiClientError) {
    return {
      message: error.message,
      statusCode: error.statusCode,
      errors: {
        code: [error.code],
        ...(typeof error.details === 'object' && error.details ? (error.details as Record<string, string[]>) : {}),
      },
    };
  }
  return {
    message: error instanceof Error ? error.message : 'Terjadi kesalahan sistem.',
    statusCode: 500,
  };
}

export const dataProvider: DataProvider = {
  getList: async <TData extends BaseRecord = BaseRecord>({ resource, pagination, sorters, filters }: GetListParams) => {
    try {
      const queryParams = new URLSearchParams();

      if (pagination) {
        const { currentPage = 1, pageSize = 25 } = pagination;
        queryParams.set('page', currentPage.toString());
        queryParams.set('pageSize', pageSize.toString());
      }

      if (sorters && sorters.length > 0) {
        const sorter = sorters[0];
        if (sorter) {
          queryParams.set('sort', `${sorter.field}.${sorter.order}`);
        }
      }

      if (filters && filters.length > 0) {
        filters.forEach((filter) => {
          if ('field' in filter && filter.value !== undefined && filter.value !== '') {
            queryParams.set(filter.field, String(filter.value));
          }
        });
      }

      const queryString = queryParams.toString();
      const endpoint = `/${resource}${queryString ? `?${queryString}` : ''}`;
      const response = await apiClient<TData[]>(endpoint, { method: 'GET' });

      return {
        data: (response.data || []) as unknown as TData[],
        total: response.meta?.total ?? (response.data ? response.data.length : 0),
      };
    } catch (error) {
      throw transformError(error);
    }
  },

  getOne: async <TData extends BaseRecord = BaseRecord>({ resource, id }: GetOneParams) => {
    try {
      const response = await apiClient<TData>(`/${resource}/${id}`, { method: 'GET' });
      return {
        data: response.data as unknown as TData,
      };
    } catch (error) {
      throw transformError(error);
    }
  },

  create: async <TData extends BaseRecord = BaseRecord, TVariables = {}>({ resource, variables }: CreateParams<TVariables>) => {
    try {
      const response = await apiClient<TData>(`/${resource}`, {
        method: 'POST',
        body: JSON.stringify(variables),
      });
      return {
        data: response.data as unknown as TData,
      };
    } catch (error) {
      throw transformError(error);
    }
  },

  update: async <TData extends BaseRecord = BaseRecord, TVariables = {}>({ resource, id, variables }: UpdateParams<TVariables>) => {
    try {
      const response = await apiClient<TData>(`/${resource}/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(variables),
      });
      return {
        data: response.data as unknown as TData,
      };
    } catch (error) {
      throw transformError(error);
    }
  },

  deleteOne: async <TData extends BaseRecord = BaseRecord, TVariables = {}>({ resource, id, variables }: DeleteOneParams<TVariables>) => {
    try {
      const response = await apiClient<TData>(`/${resource}/${id}`, {
        method: 'DELETE',
        body: variables ? JSON.stringify(variables) : undefined,
      });
      return {
        data: response.data as unknown as TData,
      };
    } catch (error) {
      throw transformError(error);
    }
  },

  getApiUrl: () => env.VITE_API_BASE_URL,

  custom: async <TData extends BaseRecord = BaseRecord, TQuery = unknown, TPayload = unknown>({ url, method, payload, query, headers }: CustomParams<TQuery, TPayload>) => {
    try {
      const queryParams = new URLSearchParams();
      if (query && typeof query === 'object') {
        Object.entries(query as Record<string, unknown>).forEach(([k, v]) => {
          if (v !== undefined && v !== null) queryParams.set(k, String(v));
        });
      }

      const qStr = queryParams.toString();
      const endpoint = `${url}${qStr ? `?${qStr}` : ''}`;

      const response = await apiClient<TData>(endpoint, {
        method: method.toUpperCase(),
        body: payload ? JSON.stringify(payload) : undefined,
        headers: headers as Record<string, string>,
      });

      return {
        data: response.data as unknown as TData,
      };
    } catch (error) {
      throw transformError(error);
    }
  },
};
