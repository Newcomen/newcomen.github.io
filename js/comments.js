/*global jQuery, moment, window, document*/
;(function (root, $, moment, p_sTitle) {

    // @TODO: Add pagination
    // @TODO: Add spinner for "loading..."
    'use strict';

    /**
     * @type jQuery
     */
    var $Container;

    /**
     * Populates variables in the given template with values from the given context
     *
     * A variable's name in the template must match a value's key in the context
     * for the variable to be replaced.
     *
     * @param p_sTemplate string
     * @param p_oContext object
     *
     * @returns string
     */
    function parseTemplate(p_sTemplate, p_oContext) {
        return p_sTemplate.replace(/{{([a-zA-Z\-_]+)}}/g, function (p_sMatch, p_sName) {
            var sMatch;

            if (p_oContext[p_sName] !== undefined) {
                sMatch = p_oContext[p_sName];
            } else {
                sMatch = p_sMatch;
            }

            return sMatch;
        });
    }

    /**
     * Outputs the remaining amount of allowed requests to the console (if it is available)
     *
     * @param p_oRequest jqXHR Request Object
     */
    function logRateLimiting(p_oRequest) {
        if (root.console !== undefined && root.console.info !== undefined) {
             root.console.info(parseTemplate('Only {{remaining}} of {{limit}} request left, reset occurs {{reset}}.', {
                'limit': p_oRequest.getResponseHeader('X-RateLimit-Limit'),
                'remaining': p_oRequest.getResponseHeader('X-RateLimit-Remaining'),
                'reset': moment.unix(p_oRequest.getResponseHeader('X-RateLimit-Reset')).fromNow()
            }));
        }
    }

    /**
     * Builds a message regarding comment availability based on the given API response
     *
     * @param p_oResponse Github API Issue Comment Response
     * @param p_sError HTTP Error Message
     *
     * @returns string
     */
    function buildMessageFromResponse(p_oResponse, p_sError) {
        var sMessage;

        if (p_sError !== undefined) {
            sMessage = parseTemplate(
                'Failed loading comments: {{error}}',
                {'error': p_sError}
            );
        } else if (p_oResponse.total_count !== undefined && p_oResponse.total_count > 0) {
            if (p_oResponse.items[0].locked === true) {
                sMessage = 'Comments are locked, commenting is no longer possible.';
            } else {
                sMessage = 'Want to leave a comment? ' +
                    '<a href="' +'{{url}}' + '">Visit this post\'s issue page on GitHub</a> ' +
                    '(requires a GitHub account).'
                ;
                sMessage = parseTemplate(sMessage, {'url': p_oResponse.items[0].html_url});
            }
        } else {
            sMessage = 'Comments are not available.';
        }

        return parseTemplate(
            '<div class="text-center well">{{message}}</div>',
            {'message': sMessage}
        );
    }

    /**
     * Adds comments from the given repository using the given template
     *
     * The given search-term and API URL are used to fetch the comments from the
     * Github API.
     *
     * @param p_sRepo string
     * @param p_sCommentTemplate string
     * @param p_sSearchTerm string
     * @param p_sApiUrl string
     */
    function addComments(p_sRepo, p_sCommentTemplate, p_sSearchTerm, p_sApiUrl) {
        var sSearchUrl;

        sSearchUrl = parseTemplate(
            '{{url}}/search/issues?q={{search-term}}+repo:{{repo}}+type:issue+in:title&per_page=100',
            {'url': p_sApiUrl, 'search-term': p_sSearchTerm, 'repo': p_sRepo}
        );

        $.ajax(sSearchUrl, {
            headers: {'Accept': 'application/vnd.github.full+json'},
            dataType: 'json'
        })
        .done(function (p_oResponse, p_sTextStatus, p_oRequest) {
            logRateLimiting(p_oRequest);
            if (p_oResponse.total_count > 0) {
                fetchComments(p_oResponse.items[0], p_sCommentTemplate);
            }
            $Container.append(buildMessageFromResponse(p_oResponse));
        })
        .fail(function (p_oRequest, p_sTextStatus, p_sErrorThrown) {
            $Container.append(buildMessageFromResponse(null, p_sErrorThrown));
        });
    }

    /**
     * Fetches the comments for the given issue, to be attached using the given template
     *
     * @param p_oIssue Github API Issue Comment Response
     * @param p_sCommentTemplate string
     */
    function fetchComments(p_oIssue, p_sCommentTemplate) {
        $.ajax(p_oIssue.comments_url + '?per_page=100', {
            headers: {Accept: 'application/vnd.github.full+json'},
            dataType: 'json'
        })
        .done(function (p_oResponse, p_sTextStatus, p_oRequest) {
            logRateLimiting(p_oRequest);
            attachComments(p_oResponse, p_sCommentTemplate, p_oIssue.user.login);
        })
        .fail(function (p_oRequest, p_sTextStatus, p_sErrorThrown) {
            $Container.append(buildMessageFromResponse(null, p_sErrorThrown));
        });
    }

    /**
     * Attaches the given comments using the given template
     *
     * If the author of the issue is the same as the author of the comment, the
     * comment is marked accordingly.
     *
     * @param p_aComments array
     * @param p_sCommentTemplate string
     * @param p_sOwner string
     */
    function attachComments(p_aComments, p_sCommentTemplate, p_sOwner) {
        var iCounter, sCommentHtml, oCurrentComment;

        for (iCounter = 0; iCounter < p_aComments.length; iCounter++) {
            oCurrentComment = p_aComments[iCounter];

            sCommentHtml = parseTemplate(p_sCommentTemplate, {
                'avatar-link': oCurrentComment.user.avatar_url,
                'body': oCurrentComment.body_html,
                'comment-link': oCurrentComment.html_url,
                'date': moment(oCurrentComment.created_at).fromNow(),
                'panel-class': (p_sOwner === oCurrentComment.user.login?'panel-info':'panel-default'),
                'user': oCurrentComment.user.login,
                'user-link': oCurrentComment.user.html_url
            });

            $Container.append(sCommentHtml);
        }
    }

    $.fn.extend({
        'githubComments': function (p_sProject, p_sCommentTemplate, p_oOptions) {
            $Container = $(this);

            p_oOptions = p_oOptions || {};

            addComments(
                p_sProject,
                p_sCommentTemplate,
                p_oOptions.title || p_sTitle,
                p_oOptions['api-url'] || 'https://api.github.com'
            );
        }
    });
}(window, jQuery, moment, document.title));

/*EOF*/
