from rest_framework import serializers

class BaseModelSerializer(serializers.ModelSerializer):
    """
    Base serializer that supports dynamic field expansion using dot notation.
    Pass 'fields' in the serializer context or query params as a comma-separated string.
    Example: ?fields=id,name,store.name
    """
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)

        request = self.context.get('request')
        if 'fields' not in self.context and request and hasattr(request, 'query_params') and 'fields' in request.query_params:
            self.context['fields'] = [f.strip() for f in request.query_params.get('fields').split(',')]

        fields = self.context.get('fields')
        if fields:
            allowed = set(['id']) # Always ensure 'id' is present
            for field in fields:
                if '.' in field:
                    # Dynamically create a ReadOnlyField that traverses the relation natively
                    flat_name = field.replace('.', '_')
                    self.fields[flat_name] = serializers.ReadOnlyField(source=field)
                    allowed.add(flat_name)
                else:
                    allowed.add(field)

            # Drop any fields not explicitly requested
            existing = set(self.fields.keys())
            for field_name in existing - allowed:
                self.fields.pop(field_name)
