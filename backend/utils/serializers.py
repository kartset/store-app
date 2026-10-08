from rest_framework import serializers

class BaseModelSerializer(serializers.ModelSerializer):
    """
    Base serializer that supports dynamic field expansion using dot notation.
    Pass 'fields' in the serializer context as a list of strings.
    Example: fields=['name', 'store.name']
    """
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        # Automatically extract '?fields=' from the request if it exists
        if 'fields' not in self.context:
            request = self.context.get('request')
            if request and hasattr(request, 'query_params') and 'fields' in request.query_params:
                self.context['fields'] = [f.strip() for f in request.query_params.get('fields').split(',')]

    def to_representation(self, instance):
        rep = super().to_representation(instance)
        if self.context.get('fields'):
            fields = self.context.get('fields')
            res = {}
            for field in fields:
                if '.' in field:
                    field_start = field.split('.')[0]
                    field_end = field.split('.')[1]
                    # First try from representation (if depth=1 or nested serializer is used)
                    if field_start in rep and isinstance(rep[field_start], dict):
                        res[field.replace('.', '_')] = rep.get(field_start, {}).get(field_end, None)
                    # Fallback to direct ORM attribute access (no nested serializers required)
                    else:
                        related_obj = getattr(instance, field_start, None)
                        if related_obj:
                            res[field.replace('.', '_')] = getattr(related_obj, field_end, None)
                else:
                    res[field] = rep.get(field, None)
            # Always ensure 'id' is present as requested
            res['id'] = str(instance.id) if hasattr(instance, 'id') else None
            rep = res
            
        return rep
