package i18n

import (
	"path/filepath"

	"github.com/mattermost/mattermost-server/v6/shared/i18n"
	"github.com/pkg/errors"
)

var TranslationFuncByLocal i18n.TranslationFuncByLocal

func TranslationsInit() error {
	translationsPath, err := filepath.Abs("../assets/i18n")
	if err != nil {
		return errors.Wrapf(err, "unable to find translation folder")
	}

	TranslationFuncByLocal, err = i18n.GetTranslationFuncForDir(translationsPath)
	if err != nil {
		return errors.Wrapf(err, "unable to load translation files")
	}
	return nil
}
