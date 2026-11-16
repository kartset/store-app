from rest_framework.pagination import PageNumberPagination
from rest_framework.response import Response


class EnhancedPageNumberPagination(PageNumberPagination):
    """
    Enhanced pagination returning Option B metadata:
    - count: total item count across all pages
    - total_pages: total number of pages
    - current_page: current active 1-indexed page
    - page_size: number of items per page
    - next: url to next page (or None)
    - previous: url to previous page (or None)
    - results: list of serialized items for this page
    """
    page_size = 5
    page_size_query_param = 'page_size'
    max_page_size = 100

    def get_paginated_response(self, data):
        return Response({
            'count': self.page.paginator.count,
            'total_pages': self.page.paginator.num_pages,
            'current_page': self.page.number,
            'page_size': self.get_page_size(self.request),
            'next': self.get_next_link(),
            'previous': self.get_previous_link(),
            'results': data,
        })
