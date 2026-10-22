from django.db import migrations


def add_categories(apps, schema_editor):
    Category = apps.get_model("catalog", "Category")
    for name in ["Electronics", "Fashion", "Home & Living", "Study Essentials", "Accessories"]:
        Category.objects.get_or_create(name=name)


def remove_categories(apps, schema_editor):
    Category = apps.get_model("catalog", "Category")
    Category.objects.filter(name__in=["Electronics", "Fashion", "Home & Living", "Study Essentials", "Accessories"]).delete()


class Migration(migrations.Migration):
    dependencies = [("catalog", "0001_initial")]
    operations = [migrations.RunPython(add_categories, remove_categories)]
