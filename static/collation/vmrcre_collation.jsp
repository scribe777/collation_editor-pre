<%@ page language="java" contentType="text/html; charset=UTF-8" pageEncoding="UTF-8"%>
<%@ page trimDirectiveWhitespaces="true" %>
<%@ page import="org.crosswire.repo.VersionedRepo" %>
<%@ page import="org.apache.log4j.Logger" %>
<%

Logger logger = Logger.getLogger("collation_editor/vmrcre_collation");
String options = request.getParameter("options");

if (options != null) {
	response.setContentType("application/json");

	String args[] = new String[] {
		"python",
		"/home/ntvmr/src/community/webapp/modules/collation_editor/python/collate_cli.py",
		options
	};

	StringBuffer resultBuf = new StringBuffer();
	StringBuffer errorBuf = new StringBuffer();
	VersionedRepo.runCommand(args, resultBuf, errorBuf);

	logger.info("Result: " + resultBuf);
	if (errorBuf.length() > 0) logger.error("Error: " + errorBuf);
%>
<%= resultBuf %>
<%
	return;
}
%>
<html>
<body>
<h1>vmrcre_collation</h1>
<p>collation from the collation_editor to collatex</p>
<h3>Parameters</h3>
<table border="1">
<tr><td><b>options</b></td><td>data from collation_editor</td></tr>
</table>
</body>
</html>
