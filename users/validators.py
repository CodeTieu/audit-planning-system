"""
Custom password validators for the password policy:
- At least 1 uppercase letter
- At least 1 number
- At least 1 special character
"""

import re
from django.core.exceptions import ValidationError


class UppercaseValidator:
    def validate(self, password, user=None):
        if not re.search(r'[A-Z]', password):
            raise ValidationError(
                'Password must contain at least one uppercase letter.',
                code='password_no_upper',
            )

    def get_help_text(self):
        return 'Your password must contain at least one uppercase letter.'


class NumberValidator:
    def validate(self, password, user=None):
        if not re.search(r'\d', password):
            raise ValidationError(
                'Password must contain at least one number.',
                code='password_no_number',
            )

    def get_help_text(self):
        return 'Your password must contain at least one number.'


class SpecialCharacterValidator:
    SPECIAL_CHARS = r'[!@#$%^&*(),.?":{}|<>_\-+=\[\]\\;\'\/`~]'

    def validate(self, password, user=None):
        if not re.search(self.SPECIAL_CHARS, password):
            raise ValidationError(
                'Password must contain at least one special character '
                '(e.g. !@#$%^&*).',
                code='password_no_special',
            )

    def get_help_text(self):
        return (
            'Your password must contain at least one special character '
            '(e.g. !@#$%^&*).'
        )
