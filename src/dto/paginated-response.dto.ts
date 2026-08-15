export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface PaginatedResponseDto<T> {
  data: T[];
  pagination: PaginationMeta;
}
